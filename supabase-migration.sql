-- ============================================
-- ACEX PORTARIA - SUPABASE MIGRATION (OFFICIAL PATTERN)
-- Arquitetura: auth.users → profiles → condominiums → residents → packages → activity_logs
-- ============================================

-- ============================================
-- 1. DROP EXISTING TABLES (CLEAN SLATE)
-- ============================================
DROP TABLE IF EXISTS password_reset_requests CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS condominiums CASCADE;

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Condominios
CREATE TABLE condominiums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (relaciona auth.users com condominiums)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doorman')),
  condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Moradores
CREATE TABLE residents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  block TEXT NOT NULL,
  apartment TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  phone TEXT,
  condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encomendas
CREATE TABLE packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  registered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delivered_to TEXT,
  delivered_at TIMESTAMPTZ,
  condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_error TEXT,
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_message_id TEXT,
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'opened', 'sent', 'failed'))
);

-- Log de Atividades
CREATE TABLE activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações de Redefinição de Senha
CREATE TABLE password_reset_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_profiles_condominium_id ON profiles(condominium_id);
CREATE INDEX idx_residents_condominium_id ON residents(condominium_id);
CREATE INDEX idx_packages_resident_id ON packages(resident_id);
CREATE INDEX idx_packages_condominium_id ON packages(condominium_id);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_activity_logs_profile_id ON activity_logs(profile_id);
CREATE INDEX idx_activity_logs_condominium_id ON activity_logs(condominium_id);
CREATE INDEX idx_password_reset_requests_condominium_id ON password_reset_requests(condominium_id);

-- ============================================
-- 4. CREATE HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================
DROP FUNCTION IF EXISTS current_user_condominium_id();
DROP FUNCTION IF EXISTS current_user_is_admin();

CREATE OR REPLACE FUNCTION current_user_condominium_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_condominium_id UUID;
BEGIN
  SELECT condominium_id INTO v_condominium_id
  FROM profiles
  WHERE id = auth.uid();
  RETURN v_condominium_id;
END;
$$;

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. DROP EXISTING POLICIES (IDEMPOTENT)
-- ============================================
DROP POLICY IF EXISTS "Usuários veem apenas seu condomínio" ON condominiums;
DROP POLICY IF EXISTS "Usuários veem perfis do seu condomínio" ON profiles;
DROP POLICY IF EXISTS "Admins inserem perfis no seu condomínio" ON profiles;
DROP POLICY IF EXISTS "Admins atualizam perfis no seu condomínio" ON profiles;
DROP POLICY IF EXISTS "Admins excluem perfis no seu condomínio" ON profiles;
DROP POLICY IF EXISTS "Usuários veem moradores do seu condomínio" ON residents;
DROP POLICY IF EXISTS "Usuários criam moradores no seu condomínio" ON residents;
DROP POLICY IF EXISTS "Usuários atualizam moradores do seu condomínio" ON residents;
DROP POLICY IF EXISTS "Usuários excluem moradores do seu condomínio" ON residents;
DROP POLICY IF EXISTS "Usuários veem encomendas do seu condomínio" ON packages;
DROP POLICY IF EXISTS "Usuários criam encomendas no seu condomínio" ON packages;
DROP POLICY IF EXISTS "Usuários atualizam encomendas do seu condomínio" ON packages;
DROP POLICY IF EXISTS "Usuários veem logs do seu condomínio" ON activity_logs;
DROP POLICY IF EXISTS "Usuários criam logs no seu condomínio" ON activity_logs;
DROP POLICY IF EXISTS "Admins veem solicitações de senha do seu condomínio" ON password_reset_requests;
DROP POLICY IF EXISTS "Usuários criam solicitações de senha para seu próprio perfil" ON password_reset_requests;
DROP POLICY IF EXISTS "Admins atualizam solicitações de senha do seu condomínio" ON password_reset_requests;

-- ============================================
-- 7. RLS POLICIES (NO RECURSION!)
-- ============================================

-- Condominiums: Usuários só veem seu condomínio
CREATE POLICY "Usuários veem apenas seu condomínio" ON condominiums
  FOR SELECT USING (id = current_user_condominium_id());

-- Profiles: 
-- - Usuários veem o próprio perfil
-- - Admins listam todos os perfis do mesmo condomínio
CREATE POLICY "Usuários veem perfil próprio ou perfis do condomínio (admin)" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR 
    (current_user_is_admin() AND condominium_id = current_user_condominium_id())
  );

CREATE POLICY "Admins inserem perfis no seu condomínio" ON profiles
  FOR INSERT WITH CHECK (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

CREATE POLICY "Admins atualizam perfis no seu condomínio" ON profiles
  FOR UPDATE USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

CREATE POLICY "Admins excluem perfis no seu condomínio" ON profiles
  FOR DELETE USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

-- Residents: CRUD completo para usuários do condomínio
CREATE POLICY "Usuários veem moradores do seu condomínio" ON residents
  FOR SELECT USING (condominium_id = current_user_condominium_id());

CREATE POLICY "Admins criam moradores no seu condomínio" ON residents
  FOR INSERT WITH CHECK (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

CREATE POLICY "Admins atualizam moradores do seu condomínio" ON residents
  FOR UPDATE USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

CREATE POLICY "Admins excluem moradores do seu condomínio" ON residents
  FOR DELETE USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

-- Packages: CRUD completo para usuários do condomínio
CREATE POLICY "Usuários veem encomendas do seu condomínio" ON packages
  FOR SELECT USING (condominium_id = current_user_condominium_id());

CREATE POLICY "Usuários criam encomendas no seu condomínio" ON packages
  FOR INSERT WITH CHECK (condominium_id = current_user_condominium_id());

CREATE POLICY "Usuários atualizam encomendas do seu condomínio" ON packages
  FOR UPDATE USING (condominium_id = current_user_condominium_id());

-- Activity Logs: Leitura e criação para usuários do condomínio
CREATE POLICY "Usuários veem logs do seu condomínio" ON activity_logs
  FOR SELECT USING (condominium_id = current_user_condominium_id());

CREATE POLICY "Usuários criam logs no seu condomínio" ON activity_logs
  FOR INSERT WITH CHECK (condominium_id = current_user_condominium_id());

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Admins veem solicitações de senha do seu condomínio" ON password_reset_requests;
DROP POLICY IF EXISTS "Usuários criam solicitações de senha para seu próprio perfil" ON password_reset_requests;
DROP POLICY IF EXISTS "Admins atualizam solicitações de senha do seu condomínio" ON password_reset_requests;
DROP POLICY IF EXISTS "users_view_own_condo_password_reset_requests" ON password_reset_requests;
DROP POLICY IF EXISTS "users_insert_own_password_reset_request" ON password_reset_requests;
DROP POLICY IF EXISTS "admins_update_own_condo_password_reset_requests" ON password_reset_requests;

-- Password Reset Requests: Apenas admins veem e gerenciam
CREATE POLICY "Admins veem solicitações de senha do seu condomínio" ON password_reset_requests
  FOR SELECT USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

-- REMOVED: Frontend should not insert directly; use request-password-reset Edge Function!

CREATE POLICY "Admins atualizam solicitações de senha do seu condomínio" ON password_reset_requests
  FOR UPDATE USING (
    current_user_is_admin() AND condominium_id = current_user_condominium_id()
  );

-- ============================================
-- 6. SEED DATA (DADOS DE DEMONSTRAÇÃO)
-- ============================================

-- Inserir condomínio
INSERT INTO condominiums (id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Condomínio Acex')
ON CONFLICT DO NOTHING;

-- Inserir 20 moradores
INSERT INTO residents (id, name, block, apartment, whatsapp, condominium_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'João Silva', 'A', '101', '5511999999901', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Maria Santos', 'A', '102', '5511999999902', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Pedro Oliveira', 'A', '201', '5511999999903', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Ana Costa', 'A', '202', '5511999999904', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Carlos Ferreira', 'B', '101', '5511999999905', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440006', 'Fernanda Lima', 'B', '102', '5511999999906', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440007', 'Ricardo Gomes', 'B', '201', '5511999999907', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440008', 'Patrícia Souza', 'B', '202', '5511999999908', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440009', 'Luiz Almeida', 'C', '101', '5511999999909', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440010', 'Mariana Rocha', 'C', '102', '5511999999910', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440011', 'José Nascimento', 'C', '201', '5511999999911', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440012', 'Amanda Ribeiro', 'C', '202', '5511999999912', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440013', 'Gustavo Carvalho', 'D', '101', '5511999999913', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440014', 'Camila Pires', 'D', '102', '5511999999914', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440015', 'Felipe Martins', 'D', '201', '5511999999915', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440016', 'Isabela Lopes', 'D', '202', '5511999999916', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440017', 'Leonardo Fernandes', 'E', '101', '5511999999917', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440018', 'Beatriz Andrade', 'E', '102', '5511999999918', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440019', 'André Costa', 'E', '201', '5511999999919', '550e8400-e29b-41d4-a716-446655440000'),
  ('550e8400-e29b-41d4-a716-446655440020', 'Juliana Araújo', 'E', '202', '5511999999920', '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT DO NOTHING;

-- ============================================
-- ATUALIZAR WHATSAPP DOS MORADORES PARA TESTES:
-- ============================================
UPDATE residents SET whatsapp = '27996976726';
