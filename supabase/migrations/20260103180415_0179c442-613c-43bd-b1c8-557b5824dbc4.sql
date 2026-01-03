-- Adicionar novos campos à tabela profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_account_owner BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN profiles.nickname IS 'Apelido utilizado no atendimento';
COMMENT ON COLUMN profiles.phone IS 'Telefone do usuário';
COMMENT ON COLUMN profiles.is_available IS 'Se o usuário está disponível para receber atendimentos';
COMMENT ON COLUMN profiles.is_account_owner IS 'Se é o dono/administrador principal da conta';

-- Índice para busca por disponibilidade
CREATE INDEX IF NOT EXISTS idx_profiles_is_available ON profiles(is_available) WHERE is_available = true;