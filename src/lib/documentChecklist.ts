// Tipos de benefício e documentos necessários para cada um

export type BenefitType = 
  | 'bpc_idoso'
  | 'bpc_deficiente'
  | 'bpc_autista'
  | 'aposentadoria_idade'
  | 'aposentadoria_tempo'
  | 'aposentadoria_especial'
  | 'aposentadoria_rural'
  | 'auxilio_doenca'
  | 'auxilio_acidente'
  | 'pensao_morte'
  | 'salario_maternidade'
  | 'auxilio_reclusao';

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  category: 'identificacao' | 'comprovantes' | 'medicos' | 'trabalhistas' | 'outros';
}

export interface BenefitDocuments {
  type: BenefitType;
  label: string;
  icon: string;
  documents: DocumentItem[];
}

// Documentos base de identificação (comuns a todos)
const documentosIdentificacao: DocumentItem[] = [
  { id: 'rg', name: 'RG', required: true, category: 'identificacao' },
  { id: 'cpf', name: 'CPF', required: true, category: 'identificacao' },
  { id: 'comprovante_residencia', name: 'Comprovante de Residência', description: 'Atualizado (últimos 3 meses)', required: true, category: 'comprovantes' },
  { id: 'certidao_nascimento_casamento', name: 'Certidão de Nascimento/Casamento', required: true, category: 'identificacao' },
];

// Documentos de renda (para BPC)
const documentosRenda: DocumentItem[] = [
  { id: 'comprovante_renda', name: 'Comprovante de Renda Familiar', description: 'De todos os membros da família', required: true, category: 'comprovantes' },
  { id: 'cadunico', name: 'CadÚnico Atualizado', description: 'Número do NIS', required: true, category: 'comprovantes' },
  { id: 'declaracao_composicao_familiar', name: 'Declaração de Composição Familiar', required: false, category: 'comprovantes' },
];

// Documentos médicos
const documentosMedicos: DocumentItem[] = [
  { id: 'laudo_medico', name: 'Laudo Médico Atualizado', description: 'Com CID e descrição detalhada', required: true, category: 'medicos' },
  { id: 'exames', name: 'Exames Complementares', description: 'Exames recentes que comprovem a condição', required: true, category: 'medicos' },
  { id: 'receituario', name: 'Receituário de Medicamentos', description: 'Medicação de uso contínuo', required: false, category: 'medicos' },
  { id: 'relatorio_tratamento', name: 'Relatório de Tratamento', description: 'Histórico médico e tratamentos realizados', required: false, category: 'medicos' },
];

// Documentos trabalhistas
const documentosTrabalhistas: DocumentItem[] = [
  { id: 'ctps', name: 'Carteira de Trabalho (CTPS)', description: 'Todas as páginas com anotações', required: true, category: 'trabalhistas' },
  { id: 'cnis', name: 'Extrato do CNIS', description: 'Cadastro Nacional de Informações Sociais', required: true, category: 'trabalhistas' },
  { id: 'carnes_inss', name: 'Carnês do INSS', description: 'Contribuições individuais, se houver', required: false, category: 'trabalhistas' },
  { id: 'ppp', name: 'PPP - Perfil Profissiográfico', description: 'Para aposentadoria especial', required: false, category: 'trabalhistas' },
];

// Definição de documentos por tipo de benefício
export const benefitDocuments: BenefitDocuments[] = [
  {
    type: 'bpc_idoso',
    label: 'BPC Idoso (65+)',
    icon: '👴',
    documents: [
      ...documentosIdentificacao,
      ...documentosRenda,
    ],
  },
  {
    type: 'bpc_deficiente',
    label: 'BPC Deficiente',
    icon: '♿',
    documents: [
      ...documentosIdentificacao,
      ...documentosRenda,
      ...documentosMedicos,
    ],
  },
  {
    type: 'bpc_autista',
    label: 'BPC Autista (TEA)',
    icon: '🧩',
    documents: [
      ...documentosIdentificacao,
      ...documentosRenda,
      ...documentosMedicos,
      { id: 'laudo_tea', name: 'Laudo Específico de TEA', description: 'Emitido por neurologista ou psiquiatra', required: true, category: 'medicos' },
      { id: 'relatorio_escola', name: 'Relatório Escolar/Terapêutico', description: 'Se aplicável', required: false, category: 'outros' },
    ],
  },
  {
    type: 'aposentadoria_idade',
    label: 'Aposentadoria por Idade',
    icon: '📅',
    documents: [
      ...documentosIdentificacao,
      ...documentosTrabalhistas,
    ],
  },
  {
    type: 'aposentadoria_tempo',
    label: 'Aposentadoria por Tempo',
    icon: '⏰',
    documents: [
      ...documentosIdentificacao,
      ...documentosTrabalhistas,
    ],
  },
  {
    type: 'aposentadoria_especial',
    label: 'Aposentadoria Especial',
    icon: '⚠️',
    documents: [
      ...documentosIdentificacao,
      ...documentosTrabalhistas,
      { id: 'ppp', name: 'PPP - Perfil Profissiográfico', description: 'Obrigatório para comprovar exposição', required: true, category: 'trabalhistas' },
      { id: 'ltcat', name: 'LTCAT', description: 'Laudo Técnico das Condições Ambientais', required: false, category: 'trabalhistas' },
    ],
  },
  {
    type: 'aposentadoria_rural',
    label: 'Aposentadoria Rural',
    icon: '🌾',
    documents: [
      ...documentosIdentificacao,
      { id: 'contrato_arrendamento', name: 'Contrato de Arrendamento/Parceria', required: false, category: 'comprovantes' },
      { id: 'notas_produtor', name: 'Notas Fiscais de Produtor Rural', required: true, category: 'comprovantes' },
      { id: 'declaracao_sindicato', name: 'Declaração de Sindicato Rural', required: true, category: 'comprovantes' },
      { id: 'certidao_itr', name: 'Certidão de ITR', description: 'Imposto Territorial Rural', required: false, category: 'comprovantes' },
    ],
  },
  {
    type: 'auxilio_doenca',
    label: 'Auxílio-Doença',
    icon: '🏥',
    documents: [
      ...documentosIdentificacao,
      { id: 'ctps', name: 'Carteira de Trabalho (CTPS)', required: true, category: 'trabalhistas' },
      ...documentosMedicos,
      { id: 'atestado_afastamento', name: 'Atestado de Afastamento', description: 'Com período de afastamento', required: true, category: 'medicos' },
    ],
  },
  {
    type: 'auxilio_acidente',
    label: 'Auxílio-Acidente',
    icon: '🚨',
    documents: [
      ...documentosIdentificacao,
      { id: 'ctps', name: 'Carteira de Trabalho (CTPS)', required: true, category: 'trabalhistas' },
      { id: 'cat', name: 'CAT - Comunicação de Acidente', description: 'Se acidente de trabalho', required: false, category: 'outros' },
      ...documentosMedicos,
      { id: 'laudo_sequela', name: 'Laudo de Sequela', description: 'Comprovando redução de capacidade', required: true, category: 'medicos' },
    ],
  },
  {
    type: 'pensao_morte',
    label: 'Pensão por Morte',
    icon: '💔',
    documents: [
      ...documentosIdentificacao,
      { id: 'certidao_obito', name: 'Certidão de Óbito', required: true, category: 'identificacao' },
      { id: 'ctps_falecido', name: 'CTPS do Falecido', required: true, category: 'trabalhistas' },
      { id: 'certidao_casamento_uniao', name: 'Certidão de Casamento/União Estável', required: true, category: 'identificacao' },
      { id: 'docs_dependentes', name: 'Documentos dos Dependentes', description: 'RG/CPF/Certidão de todos', required: true, category: 'identificacao' },
    ],
  },
  {
    type: 'salario_maternidade',
    label: 'Salário-Maternidade',
    icon: '👶',
    documents: [
      ...documentosIdentificacao,
      { id: 'ctps', name: 'Carteira de Trabalho (CTPS)', required: true, category: 'trabalhistas' },
      { id: 'certidao_nascimento_filho', name: 'Certidão de Nascimento do Filho', description: 'Ou termo de guarda/adoção', required: true, category: 'identificacao' },
      { id: 'atestado_medico', name: 'Atestado Médico', description: 'Com data provável do parto', required: false, category: 'medicos' },
    ],
  },
  {
    type: 'auxilio_reclusao',
    label: 'Auxílio-Reclusão',
    icon: '⛓️',
    documents: [
      ...documentosIdentificacao,
      { id: 'certidao_carceraria', name: 'Certidão Carcerária', description: 'Atualizada mensalmente', required: true, category: 'outros' },
      { id: 'ctps_recluso', name: 'CTPS do Recluso', required: true, category: 'trabalhistas' },
      { id: 'docs_dependentes', name: 'Documentos dos Dependentes', required: true, category: 'identificacao' },
      { id: 'certidao_casamento_uniao', name: 'Certidão de Casamento/União Estável', required: true, category: 'identificacao' },
    ],
  },
];

// Função para obter documentos por tipo de benefício
export function getDocumentsByBenefitType(type: BenefitType): BenefitDocuments | undefined {
  return benefitDocuments.find(b => b.type === type);
}

// Função para detectar tipo de benefício pelas etiquetas
export function detectBenefitTypeFromLabels(labels: { name: string }[]): BenefitType | null {
  const labelNames = labels.map(l => l.name.toLowerCase());
  
  if (labelNames.some(l => l.includes('bpc') && l.includes('idoso'))) return 'bpc_idoso';
  if (labelNames.some(l => l.includes('autist') || l.includes('tea'))) return 'bpc_autista';
  if (labelNames.some(l => l.includes('bpc') && (l.includes('deficiente') || l.includes('deficiência')))) return 'bpc_deficiente';
  if (labelNames.some(l => l.includes('aposentadoria') && l.includes('rural'))) return 'aposentadoria_rural';
  if (labelNames.some(l => l.includes('aposentadoria') && l.includes('especial'))) return 'aposentadoria_especial';
  if (labelNames.some(l => l.includes('aposentadoria') && l.includes('tempo'))) return 'aposentadoria_tempo';
  if (labelNames.some(l => l.includes('aposentadoria'))) return 'aposentadoria_idade';
  if (labelNames.some(l => l.includes('auxílio') && l.includes('doença'))) return 'auxilio_doenca';
  if (labelNames.some(l => l.includes('auxílio') && l.includes('acidente'))) return 'auxilio_acidente';
  if (labelNames.some(l => l.includes('pensão') || l.includes('pensao'))) return 'pensao_morte';
  if (labelNames.some(l => l.includes('maternidade'))) return 'salario_maternidade';
  if (labelNames.some(l => l.includes('reclusão') || l.includes('reclusao'))) return 'auxilio_reclusao';
  
  return null;
}

// Mapeamento de ícones por categoria
export const categoryIcons: Record<DocumentItem['category'], string> = {
  identificacao: '🪪',
  comprovantes: '📋',
  medicos: '🏥',
  trabalhistas: '💼',
  outros: '📎',
};

// Labels das categorias
export const categoryLabels: Record<DocumentItem['category'], string> = {
  identificacao: 'Identificação',
  comprovantes: 'Comprovantes',
  medicos: 'Documentos Médicos',
  trabalhistas: 'Documentos Trabalhistas',
  outros: 'Outros',
};
