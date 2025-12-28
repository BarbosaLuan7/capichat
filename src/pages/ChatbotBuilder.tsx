import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  MessageSquare,
  Clock,
  Tag,
  ArrowRight,
  Settings,
  Save,
  Zap,
  X,
  GripVertical,
  List,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  useChatbotFlows, 
  useChatbotFlow,
  useCreateChatbotFlow, 
  useUpdateChatbotFlow, 
  useDeleteChatbotFlow,
  type FlowNode, 
  type FlowConnection 
} from '@/hooks/useChatbotFlows';


const nodeTypes = [
  { type: 'trigger', label: 'Gatilho', icon: Zap, color: 'bg-primary' },
  { type: 'wait', label: 'Esperar', icon: Clock, color: 'bg-warning' },
  { type: 'message', label: 'Mensagem', icon: MessageSquare, color: 'bg-success' },
  { type: 'add_label', label: 'Adicionar Etiqueta', icon: Tag, color: 'bg-accent' },
  { type: 'remove_label', label: 'Remover Etiqueta', icon: Tag, color: 'bg-destructive' },
  { type: 'move_stage', label: 'Mover Etapa', icon: ArrowRight, color: 'bg-purple-500' },
];

const triggerOptions = [
  { value: 'lead_created', label: 'Lead criado' },
  { value: 'lead_stage_changed', label: 'Etapa alterada' },
  { value: 'lead_no_response', label: 'Sem resposta (tempo)' },
  { value: 'lead_label_added', label: 'Etiqueta adicionada' },
  { value: 'conversation_no_response', label: 'Conversa sem resposta' },
];

const ChatbotBuilder = () => {
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Novo Fluxo');
  const [flowDescription, setFlowDescription] = useState('');
  const [nodes, setNodes] = useState<FlowNode[]>([
    {
      id: '1',
      type: 'trigger',
      data: { trigger: 'lead_created' },
      position: { x: 100, y: 50 },
    },
  ]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);

  // Hooks para persistência
  const { data: flows = [], isLoading: isLoadingFlows } = useChatbotFlows();
  const { data: currentFlow, isLoading: isLoadingFlow } = useChatbotFlow(currentFlowId);
  const createFlow = useCreateChatbotFlow();
  const updateFlow = useUpdateChatbotFlow();
  const deleteFlow = useDeleteChatbotFlow();

  // Carregar fluxo selecionado
  useEffect(() => {
    if (currentFlow) {
      setFlowName(currentFlow.name);
      setFlowDescription(currentFlow.description || '');
      setNodes(currentFlow.nodes.length > 0 ? currentFlow.nodes : [{
        id: '1',
        type: 'trigger',
        data: { trigger: 'lead_created' },
        position: { x: 100, y: 50 },
      }]);
      setConnections(currentFlow.connections);
    }
  }, [currentFlow]);

  const addNode = (type: string) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: type as FlowNode['type'],
      data: {},
      position: { x: 100 + nodes.length * 50, y: 150 + nodes.length * 100 },
    };

    // Set default data based on type
    if (type === 'wait') {
      newNode.data = { duration: 60, unit: 'seconds' };
    } else if (type === 'message') {
      newNode.data = { content: '' };
    } else if (type === 'trigger') {
      newNode.data = { trigger: 'lead_created' };
    }

    setNodes([...nodes, newNode]);

    // Auto-connect to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setConnections([...connections, { from: lastNode.id, to: newNode.id }]);
    }

    toast.success(`Nó "${nodeTypes.find(n => n.type === type)?.label}" adicionado`);
  };

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeEditor(false);
    }
  };

  const updateNodeData = (nodeId: string, data: Record<string, any>) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...data } });
    }
  };

  const handleNodeClick = (node: FlowNode) => {
    setSelectedNode(node);
    setShowNodeEditor(true);
  };

  const handleNewFlow = () => {
    setCurrentFlowId(null);
    setFlowName('Novo Fluxo');
    setFlowDescription('');
    setNodes([{
      id: '1',
      type: 'trigger',
      data: { trigger: 'lead_created' },
      position: { x: 100, y: 50 },
    }]);
    setConnections([]);
    setSelectedNode(null);
    setShowNodeEditor(false);
  };

  const handleSelectFlow = (flowId: string) => {
    setCurrentFlowId(flowId);
    setSelectedNode(null);
    setShowNodeEditor(false);
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (confirm('Tem certeza que deseja excluir este fluxo?')) {
      await deleteFlow.mutateAsync(flowId);
      if (currentFlowId === flowId) {
        handleNewFlow();
      }
    }
  };

  const saveFlow = async () => {
    if (!flowName.trim()) {
      toast.error('O nome do fluxo é obrigatório');
      return;
    }

    try {
      if (currentFlowId) {
        // Atualizar fluxo existente
        await updateFlow.mutateAsync({
          id: currentFlowId,
          name: flowName,
          description: flowDescription || null,
          nodes,
          connections,
        });
      } else {
        // Criar novo fluxo
        const result = await createFlow.mutateAsync({
          name: flowName,
          description: flowDescription || undefined,
          nodes,
          connections,
        });
        setCurrentFlowId(result.id);
      }
    } catch {
      // Erro já tratado pelo hook
    }
  };

  const isSaving = createFlow.isPending || updateFlow.isPending;

  const getNodeIcon = (type: string) => {
    return nodeTypes.find(n => n.type === type)?.icon || Settings;
  };

  const getNodeColor = (type: string) => {
    return nodeTypes.find(n => n.type === type)?.color || 'bg-muted';
  };

  const getNodeLabel = (type: string) => {
    return nodeTypes.find(n => n.type === type)?.label || type;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Sidebar - Node Palette */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Editor de Fluxo
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Arraste os blocos para o canvas
          </p>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              Blocos Disponíveis
            </p>
            {nodeTypes.map((nodeType) => (
              <motion.div
                key={nodeType.type}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-grab"
                draggable
                onDragStart={() => setDraggedNodeType(nodeType.type)}
                onDragEnd={() => setDraggedNodeType(null)}
                onClick={() => addNode(nodeType.type)}
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', nodeType.color)}>
                      <nodeType.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{nodeType.label}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border space-y-2">
          <Button onClick={saveFlow} className="w-full gap-2" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {currentFlowId ? 'Salvar Alterações' : 'Salvar Fluxo'}
          </Button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Canvas Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card">
          <div className="flex items-center gap-3">
            {/* Dropdown de fluxos salvos */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <List className="w-4 h-4" />
                  {isLoadingFlows ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Fluxos ({flows.length})</>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={handleNewFlow} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Fluxo
                </DropdownMenuItem>
                {flows.length > 0 && <DropdownMenuSeparator />}
                {flows.map((flow) => (
                  <DropdownMenuItem 
                    key={flow.id} 
                    className="flex items-center justify-between"
                    onClick={() => handleSelectFlow(flow.id)}
                  >
                    <span className={cn(
                      "truncate",
                      currentFlowId === flow.id && "font-semibold text-primary"
                    )}>
                      {flow.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {flow.is_active && (
                        <Badge variant="outline" className="text-xs text-success border-success">
                          Ativo
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFlow(flow.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="w-64 font-semibold"
              placeholder="Nome do fluxo"
            />
            <Badge variant="outline" className="text-xs">
              {nodes.length} blocos
            </Badge>
            {currentFlowId && (
              <Badge variant="secondary" className="text-xs">
                Editando
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Play className="w-4 h-4" />
              Testar
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 bg-muted/30 overflow-auto p-8"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggedNodeType) {
              addNode(draggedNodeType);
            }
          }}
        >
          <div className="min-h-full min-w-full relative">
            {/* Connection Lines */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              {connections.map((conn, index) => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                
                const fromX = fromNode.position.x + 120;
                const fromY = fromNode.position.y + 40;
                const toX = toNode.position.x + 120;
                const toY = toNode.position.y;
                
                return (
                  <g key={index}>
                    <path
                      d={`M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,5"
                    />
                    <circle cx={toX} cy={toY} r="4" fill="hsl(var(--primary))" />
                  </g>
                );
              })}
            </svg>

            {/* Flow Nodes */}
            {nodes.map((node) => {
              const Icon = getNodeIcon(node.type);
              const colorClass = getNodeColor(node.type);
              
              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute"
                  style={{ left: node.position.x, top: node.position.y }}
                  drag
                  dragMomentum={false}
                  onDragEnd={(_, info) => {
                    setNodes(nodes.map(n => 
                      n.id === node.id 
                        ? { ...n, position: { x: n.position.x + info.offset.x, y: n.position.y + info.offset.y } }
                        : n
                    ));
                  }}
                >
                  <Card 
                    className={cn(
                      'w-60 cursor-pointer hover:shadow-lg transition-shadow',
                      selectedNode?.id === node.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => handleNodeClick(node)}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', colorClass)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <CardTitle className="text-sm">{getNodeLabel(node.type)}</CardTitle>
                        </div>
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                          {node.type !== 'trigger' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNode(node.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {node.type === 'trigger' && triggerOptions.find(t => t.value === node.data.trigger)?.label}
                        {node.type === 'wait' && `Esperar ${node.data.duration || 0}s`}
                        {node.type === 'message' && (node.data.content || 'Configurar mensagem...')}
                        {node.type === 'add_label' && (node.data.label || 'Selecionar etiqueta...')}
                        {node.type === 'remove_label' && (node.data.label || 'Selecionar etiqueta...')}
                        {node.type === 'move_stage' && (node.data.stage || 'Selecionar etapa...')}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Comece arrastando um bloco</p>
                  <p className="text-sm">Clique em um bloco à esquerda para adicionar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Node Editor Sheet */}
      <Sheet open={showNodeEditor} onOpenChange={setShowNodeEditor}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedNode && (
                <>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', getNodeColor(selectedNode.type))}>
                    {(() => { const Icon = getNodeIcon(selectedNode.type); return <Icon className="w-4 h-4" />; })()}
                  </div>
                  {getNodeLabel(selectedNode.type)}
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedNode && (
            <div className="mt-6 space-y-4">
              {selectedNode.type === 'trigger' && (
                <div className="space-y-2">
                  <Label>Gatilho</Label>
                  <Select
                    value={selectedNode.data.trigger}
                    onValueChange={(v) => updateNodeData(selectedNode.id, { trigger: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedNode.type === 'wait' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input
                      type="number"
                      value={selectedNode.data.duration || 0}
                      onChange={(e) => updateNodeData(selectedNode.id, { duration: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select
                      value={selectedNode.data.unit || 'seconds'}
                      onValueChange={(v) => updateNodeData(selectedNode.id, { unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seconds">Segundos</SelectItem>
                        <SelectItem value="minutes">Minutos</SelectItem>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'message' && (
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={selectedNode.data.content || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { content: e.target.value })}
                    placeholder="Digite a mensagem a ser enviada..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{{nome}}'}, {'{{telefone}}'} para variáveis
                  </p>
                </div>
              )}

              {(selectedNode.type === 'add_label' || selectedNode.type === 'remove_label') && (
                <div className="space-y-2">
                  <Label>Etiqueta</Label>
                  <Input
                    value={selectedNode.data.label || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    placeholder="Nome da etiqueta..."
                  />
                </div>
              )}

              {selectedNode.type === 'move_stage' && (
                <div className="space-y-2">
                  <Label>Etapa do Funil</Label>
                  <Input
                    value={selectedNode.data.stage || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { stage: e.target.value })}
                    placeholder="Nome da etapa..."
                  />
                </div>
              )}

              <Separator className="my-4" />

              <Button 
                variant="destructive" 
                className="w-full gap-2"
                onClick={() => {
                  removeNode(selectedNode.id);
                  setShowNodeEditor(false);
                }}
                disabled={selectedNode.type === 'trigger'}
              >
                <Trash2 className="w-4 h-4" />
                Remover Bloco
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChatbotBuilder;