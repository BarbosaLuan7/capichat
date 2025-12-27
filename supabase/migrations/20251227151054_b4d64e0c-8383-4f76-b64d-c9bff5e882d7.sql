-- Permitir que usuários atualizem suas próprias notas
CREATE POLICY "Users can update own notes" ON public.internal_notes
FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Permitir que usuários excluam suas próprias notas
CREATE POLICY "Users can delete own notes" ON public.internal_notes
FOR DELETE
USING (author_id = auth.uid());

-- Admins podem atualizar qualquer nota
CREATE POLICY "Admins can update all notes" ON public.internal_notes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem excluir qualquer nota
CREATE POLICY "Admins can delete all notes" ON public.internal_notes
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));