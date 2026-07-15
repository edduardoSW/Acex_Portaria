-- =========================================================
-- ACEX PORTARIA
-- Correção: renomear user_id para profile_id, RLS de packages e password_reset_requests
-- =========================================================

-- Passo 1: renomear user_id para profile_id em password_reset_requests (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_requests'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_requests'
      AND column_name = 'profile_id'
  )
  THEN
    ALTER TABLE public.password_reset_requests
    RENAME COLUMN user_id TO profile_id;
  END IF;
END
$$;

-- Passo 2: garantir chave estrangeira com profiles (idempotente)
ALTER TABLE public.password_reset_requests
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.packages
ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.password_reset_requests
  DROP CONSTRAINT IF EXISTS password_reset_requests_user_id_fkey;

  ALTER TABLE public.password_reset_requests
  DROP CONSTRAINT IF EXISTS password_reset_requests_profile_id_fkey;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_requests'
      AND column_name = 'profile_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_requests'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'password_reset_requests_profile_id_fkey'
  )
  THEN
    ALTER TABLE public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_profile_id
ON public.password_reset_requests(profile_id);

-- Passo 3: resetar policies de password_reset_requests (idempotente)
DO $$
DECLARE
  policy_item RECORD;
BEGIN
  FOR policy_item IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'password_reset_requests'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.password_reset_requests',
      policy_item.policyname
    );
  END LOOP;
END
$$;

-- Administradores visualizam solicitações do seu condomínio
CREATE POLICY "password_reset_admin_select_same_condominium"
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
);

-- Administradores atualizam solicitações do seu condomínio
CREATE POLICY "password_reset_admin_update_same_condominium"
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
)
WITH CHECK (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
);

-- Passo 4: atualizar policies de packages (idempotente)
DO $$
DECLARE
  policy_item RECORD;
BEGIN
  FOR policy_item IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.packages',
      policy_item.policyname
    );
  END LOOP;
END
$$;

CREATE POLICY "packages_select_same_condominium"
ON public.packages
FOR SELECT
TO authenticated
USING (
  condominium_id = public.current_user_condominium_id()
);

CREATE POLICY "packages_insert_same_condominium"
ON public.packages
FOR INSERT
TO authenticated
WITH CHECK (
  condominium_id = public.current_user_condominium_id()
);

CREATE POLICY "packages_update_same_condominium"
ON public.packages
FOR UPDATE
TO authenticated
USING (
  condominium_id = public.current_user_condominium_id()
)
WITH CHECK (
  condominium_id = public.current_user_condominium_id()
);
