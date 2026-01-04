-- Atualizar is_account_owner para os usuários privilegiados
UPDATE profiles 
SET is_account_owner = true 
WHERE email IN ('luan@luan.com', 'thawanrmichels@gmail.com');

-- Garantir que outros usuários não são account owners
UPDATE profiles 
SET is_account_owner = false 
WHERE email NOT IN ('luan@luan.com', 'thawanrmichels@gmail.com')
  AND is_account_owner = true;