-- Corrige somente o preco do plano Enterprise para que seu custo por
-- usuario autorizado (R$ 499 / 3) seja menor que o Profissional (R$ 349 / 2).

UPDATE public.condominiums
SET monthly_value = 499,
    updated_at = NOW()
WHERE plan = 'enterprise'
  AND monthly_value = 599;

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
    selected_price := 499;
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
