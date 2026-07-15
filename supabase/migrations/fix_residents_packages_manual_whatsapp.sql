-- =========================================================
-- ACEX PORTARIA
-- Correção idempotente de RLS para residents e packages
-- =========================================================

-- 1. Remover todas as políticas atuais de residents e packages
DO $$
DECLARE
  policy_item RECORD;
BEGIN
  FOR policy_item IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('residents', 'packages')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_item.policyname,
      policy_item.schemaname,
      policy_item.tablename
    );
  END LOOP;
END
$$;

-- 2. Criar ou atualizar as funções auxiliares
-- Não utilizar DROP FUNCTION, pois outras policies podem depender delas.

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

-- 3. Restringir permissões das funções
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

-- 4. Garantir que RLS esteja habilitado
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- POLÍTICAS: RESIDENTS
-- =========================================================

-- Administradores e porteiros podem visualizar moradores
-- pertencentes ao próprio condomínio.
CREATE POLICY "residents_select_same_condominium"
ON public.residents
FOR SELECT
TO authenticated
USING (
  condominium_id = public.current_user_condominium_id()
);

-- Somente administradores podem cadastrar moradores.
CREATE POLICY "residents_admin_insert"
ON public.residents
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
);

-- Somente administradores podem editar moradores.
CREATE POLICY "residents_admin_update"
ON public.residents
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

-- Somente administradores podem excluir moradores.
CREATE POLICY "residents_admin_delete"
ON public.residents
FOR DELETE
TO authenticated
USING (
  public.current_user_is_admin()
  AND condominium_id = public.current_user_condominium_id()
);

-- =========================================================
-- POLÍTICAS: PACKAGES
-- =========================================================

-- Administradores e porteiros podem visualizar encomendas
-- do próprio condomínio.
CREATE POLICY "packages_select_same_condominium"
ON public.packages
FOR SELECT
TO authenticated
USING (
  condominium_id = public.current_user_condominium_id()
);

-- Administradores e porteiros podem registrar encomendas
-- somente no próprio condomínio.
CREATE POLICY "packages_insert_same_condominium"
ON public.packages
FOR INSERT
TO authenticated
WITH CHECK (
  condominium_id = public.current_user_condominium_id()
);

-- Administradores e porteiros podem atualizar encomendas
-- somente no próprio condomínio.
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