-- Geração e substituição atômica de códigos de retirada pela Edge Function.
-- Reaproveita package_pickup_codes e package_pickup_events criadas em 0003.

ALTER TABLE public.package_pickup_codes
  ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0
    CHECK (resend_count >= 0);

CREATE OR REPLACE FUNCTION public.rotate_package_pickup_code(
  p_package_id UUID,
  p_profile_id UUID,
  p_code_hash TEXT,
  p_code_salt TEXT,
  p_expires_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package public.packages%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_resend_count INTEGER;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
    AND status = 'active'
    AND role IN ('admin', 'doorman');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_package
  FROM public.packages
  WHERE id = p_package_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_package.condominium_id <> v_profile.condominium_id
    OR v_package.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_resident
  FROM public.residents
  WHERE id = v_package.resident_id
    AND condominium_id = v_package.condominium_id;

  IF NOT FOUND OR NULLIF(trim(v_resident.email), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_unavailable');
  END IF;

  SELECT COALESCE(MAX(resend_count), -1) + 1
    INTO v_resend_count
  FROM public.package_pickup_codes
  WHERE package_id = v_package.id;

  UPDATE public.package_pickup_codes
  SET active = false,
      invalidated_at = now()
  WHERE package_id = v_package.id
    AND active = true;

  INSERT INTO public.package_pickup_codes (
    package_id, resident_id, code_hash, code_salt, expires_at,
    failed_attempts, locked_until, active, resend_count
  ) VALUES (
    v_package.id, v_resident.id, p_code_hash, p_code_salt, p_expires_at,
    0, NULL, true, v_resend_count
  );

  RETURN jsonb_build_object(
    'ok', true,
    'package_id', v_package.id,
    'resident_id', v_resident.id,
    'resident_name', v_resident.name,
    'resident_email', v_resident.email,
    'condominium_id', v_package.condominium_id,
    'package_created_at', v_package.created_at,
    'resend_count', v_resend_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_package_pickup_code(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_package_pickup_code(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

