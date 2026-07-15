-- =========================================================
-- ACEX PORTARIA
-- Correção segura de password_reset_requests
-- =========================================================

-- Não apagar as funções, pois outras policies dependem delas.
CREATE OR REPLACE FUNCTION public.current_user_condominium_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT condominium_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role = 'admin'
      FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ),
    FALSE
  );
$$;

REVOKE ALL
ON FUNCTION public.current_user_condominium_id()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.current_user_is_admin()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.current_user_condominium_id()
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.current_user_is_admin()
TO authenticated;

ALTER TABLE public.password_reset_requests
ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies anteriores da tabela.
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

-- Administradores veem solicitações do próprio condomínio.
CREATE POLICY "password_reset_admin_select_same_condominium"
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
);

-- Administradores atualizam solicitações do próprio condomínio.
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

-- Não criar policy de INSERT para anon ou authenticated.
-- A solicitação será criada por uma Edge Function usando service_role.