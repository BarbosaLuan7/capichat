-- Criar bucket público para avatares de leads
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-avatars', 'lead-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy para leitura pública
CREATE POLICY "Avatars são públicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-avatars');

-- Policy para upload via service role
CREATE POLICY "Service role pode fazer upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lead-avatars');

-- Policy para atualização via service role
CREATE POLICY "Service role pode atualizar avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'lead-avatars');