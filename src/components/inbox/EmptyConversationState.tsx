import React from 'react';
import { MessageSquare } from 'lucide-react';

export function EmptyConversationState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Selecione uma conversa</h3>
        <p className="text-muted-foreground">
          Escolha uma conversa na lista para comecar a atender
        </p>
      </div>
    </div>
  );
}
