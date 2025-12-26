-- Habilita REPLICA IDENTITY FULL para capturar dados completos
ALTER TABLE lead_labels REPLICA IDENTITY FULL;

-- Adiciona lead_labels à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lead_labels;