-- Confirmação segura de retirada por código enviado por e-mail.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS residents_condominium_email_unique
  ON public.residents (condominium_id, lower(email)) WHERE email IS NOT NULL;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS email_delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_delivery_status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS email_last_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.package_pickup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  used_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS package_pickup_codes_one_active
  ON public.package_pickup_codes(package_id) WHERE active;
CREATE INDEX IF NOT EXISTS package_pickup_codes_package_id
  ON public.package_pickup_codes(package_id);

CREATE TABLE IF NOT EXISTS public.package_pickup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'email_sent', 'email_failed', 'code_resent', 'code_regenerated',
    'attempt_failed', 'attempt_blocked', 'code_expired', 'confirmed'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS package_pickup_events_package_created
  ON public.package_pickup_events(package_id, created_at DESC);

ALTER TABLE public.package_pickup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_pickup_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pickup_events_select_same_condominium ON public.package_pickup_events;
CREATE POLICY pickup_events_select_same_condominium
  ON public.package_pickup_events FOR SELECT TO authenticated
  USING (condominium_id = public.current_user_condominium_id());

-- Impede baixa direta pela API; a transição para entregue exige a função de validação.
CREATE OR REPLACE FUNCTION public.guard_package_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'delivered'
    AND current_setting('app.pickup_code_verified', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A retirada exige confirmação do código no backend';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS packages_require_pickup_code ON public.packages;
CREATE TRIGGER packages_require_pickup_code
  BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.guard_package_delivery();

-- A validação e a baixa são atômicas e executadas apenas pela Edge Function.
CREATE OR REPLACE FUNCTION public.verify_package_pickup_code(
  p_package_id UUID,
  p_code TEXT,
  p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code package_pickup_codes%ROWTYPE;
  v_package packages%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_expected_hash TEXT;
  v_attempts INTEGER;
  v_lock_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id AND status = 'active';
  IF NOT FOUND OR v_profile.role <> 'doorman' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_package FROM packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_package.condominium_id <> v_profile.condominium_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_package.status = 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_delivered');
  END IF;

  SELECT * INTO v_code FROM package_pickup_codes
    WHERE package_id = p_package_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_code.expires_at <= now() THEN
    UPDATE package_pickup_codes SET active = false, invalidated_at = now() WHERE id = v_code.id;
    INSERT INTO package_pickup_events(package_id, resident_id, profile_id, condominium_id, event_type)
      VALUES (v_package.id, v_package.resident_id, v_profile.id, v_profile.condominium_id, 'code_expired');
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF v_code.locked_until IS NOT NULL AND v_code.locked_until > now() THEN
    INSERT INTO package_pickup_events(package_id, resident_id, profile_id, condominium_id, event_type)
      VALUES (v_package.id, v_package.resident_id, v_profile.id, v_profile.condominium_id, 'attempt_blocked');
    RETURN jsonb_build_object('ok', false, 'reason', 'locked',
      'retry_after_seconds', ceil(extract(epoch FROM (v_code.locked_until - now())))::integer);
  END IF;

  IF v_code.locked_until IS NOT NULL AND v_code.locked_until <= now() THEN
    UPDATE package_pickup_codes SET failed_attempts = 0, locked_until = NULL WHERE id = v_code.id;
    v_code.failed_attempts := 0;
  END IF;

  v_expected_hash := encode(digest(v_code.code_salt || ':' || p_code, 'sha256'), 'hex');
  IF v_expected_hash <> v_code.code_hash THEN
    v_attempts := v_code.failed_attempts + 1;
    v_lock_until := CASE WHEN v_attempts >= 5 THEN now() + interval '10 minutes' ELSE NULL END;
    UPDATE package_pickup_codes
      SET failed_attempts = v_attempts, locked_until = v_lock_until
      WHERE id = v_code.id;
    INSERT INTO package_pickup_events(package_id, resident_id, profile_id, condominium_id, event_type, metadata)
      VALUES (v_package.id, v_package.resident_id, v_profile.id, v_profile.condominium_id,
        CASE WHEN v_lock_until IS NULL THEN 'attempt_failed' ELSE 'attempt_blocked' END,
        jsonb_build_object('failed_attempts', v_attempts));
    RETURN jsonb_build_object('ok', false,
      'reason', CASE WHEN v_lock_until IS NULL THEN 'invalid' ELSE 'locked' END,
      'remaining_attempts', greatest(0, 5 - v_attempts),
      'retry_after_seconds', CASE WHEN v_lock_until IS NULL THEN 0 ELSE 600 END);
  END IF;

  PERFORM set_config('app.pickup_code_verified', 'true', true);
  UPDATE packages SET status = 'delivered', delivered_by = v_profile.id,
    delivered_to = (SELECT name FROM residents WHERE id = v_package.resident_id),
    delivered_at = now() WHERE id = v_package.id;
  UPDATE package_pickup_codes SET active = false, used_at = now(), invalidated_at = now()
    WHERE id = v_code.id;
  INSERT INTO package_pickup_events(package_id, resident_id, profile_id, condominium_id, event_type)
    VALUES (v_package.id, v_package.resident_id, v_profile.id, v_profile.condominium_id, 'confirmed');
  INSERT INTO activity_logs(action, profile_id, package_id, condominium_id)
    VALUES ('package_delivered_by_code', v_profile.id, v_package.id, v_profile.condominium_id);

  RETURN jsonb_build_object('ok', true, 'reason', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_package_pickup_code(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_package_pickup_code(UUID, TEXT, UUID) TO service_role;

-- Nenhum cliente acessa hashes/salts; somente service_role (Edge Function).
REVOKE ALL ON public.package_pickup_codes FROM anon, authenticated;
GRANT ALL ON public.package_pickup_codes TO service_role;
GRANT ALL ON public.package_pickup_events TO service_role;
