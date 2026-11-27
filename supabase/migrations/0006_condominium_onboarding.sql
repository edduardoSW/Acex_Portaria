-- Onboarding de condominios e contas administradoras.
-- Pode ser executada mais de uma vez sem apagar dados existentes.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('general_manager', 'admin', 'doorman'));

ALTER TABLE public.profiles ALTER COLUMN condominium_id DROP NOT NULL;

ALTER TABLE public.condominiums
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

-- Cria o condominio e o perfil admin quando o cadastro parte da landing page.
-- Outros usuarios do Auth (Google, convites internos etc.) nao sao afetados.
CREATE OR REPLACE FUNCTION public.handle_acex_trial_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  condominium_id UUID;
  units INTEGER;
  selected_plan TEXT;
  selected_price NUMERIC(10, 2);
BEGIN
  IF metadata->>'acex_signup_source' IS DISTINCT FROM 'landing_trial' THEN
    RETURN NEW;
  END IF;

  units := GREATEST(1, LEAST(600, COALESCE((metadata->>'units_count')::INTEGER, 1)));

  IF units <= 150 THEN
    selected_plan := 'essential';
    selected_price := 199;
  ELSIF units <= 350 THEN
    selected_plan := 'professional';
    selected_price := 349;
  ELSE
    selected_plan := 'enterprise';
    selected_price := 599;
  END IF;

  INSERT INTO public.condominiums (
    name,
    units_count,
    plan,
    subscription_status,
    monthly_value,
    trial_ends_at,
    contact_name,
    contact_email
  ) VALUES (
    NULLIF(BTRIM(metadata->>'condominium_name'), ''),
    units,
    selected_plan,
    'trial',
    selected_price,
    NOW() + INTERVAL '15 days',
    NULLIF(BTRIM(metadata->>'name'), ''),
    LOWER(NEW.email)
  )
  RETURNING id INTO condominium_id;

  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    condominium_id,
    status
  ) VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NULLIF(BTRIM(metadata->>'name'), ''), SPLIT_PART(NEW.email, '@', 1)),
    'admin',
    condominium_id,
    'active'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_acex_trial_signup ON auth.users;
CREATE TRIGGER on_acex_trial_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_acex_trial_signup();

