-- Gerenciador geral ACEX e dados comerciais dos condominios.
-- Migration incremental: pode ser aplicada no projeto compartilhado sem apagar dados.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('general_manager', 'admin', 'doorman'));

-- O gerenciador geral pertence a ACEX, nao a um condominio especifico.
ALTER TABLE profiles ALTER COLUMN condominium_id DROP NOT NULL;

ALTER TABLE condominiums
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS units_count INTEGER NOT NULL DEFAULT 0 CHECK (units_count >= 0),
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'essential'
    CHECK (plan IN ('essential', 'professional', 'enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'overdue', 'cancelled')),
  ADD COLUMN IF NOT EXISTS monthly_value NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (monthly_value >= 0),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_condominiums_subscription_status
  ON condominiums(subscription_status);

CREATE OR REPLACE FUNCTION current_user_is_general_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'general_manager' AND status = 'active'
     FROM profiles
     WHERE id = auth.uid()),
    false
  );
$$;

DROP POLICY IF EXISTS "Gerenciador geral ve todos os condominios" ON condominiums;
CREATE POLICY "Gerenciador geral ve todos os condominios" ON condominiums
  FOR SELECT USING (current_user_is_general_manager());

DROP POLICY IF EXISTS "Gerenciador geral cadastra condominios" ON condominiums;
CREATE POLICY "Gerenciador geral cadastra condominios" ON condominiums
  FOR INSERT WITH CHECK (current_user_is_general_manager());

DROP POLICY IF EXISTS "Gerenciador geral atualiza condominios" ON condominiums;
CREATE POLICY "Gerenciador geral atualiza condominios" ON condominiums
  FOR UPDATE
  USING (current_user_is_general_manager())
  WITH CHECK (current_user_is_general_manager());

DROP POLICY IF EXISTS "Gerenciador geral ve perfis" ON profiles;
CREATE POLICY "Gerenciador geral ve perfis" ON profiles
  FOR SELECT USING (current_user_is_general_manager());

COMMENT ON COLUMN condominiums.subscription_status IS
  'Situacao comercial da assinatura ACEX: trial, active, overdue ou cancelled.';

-- Para promover um usuario ja criado no Supabase Auth:
-- UPDATE profiles
-- SET role = 'general_manager', condominium_id = NULL, status = 'active'
-- WHERE email = 'gestor@acex.com.br';
