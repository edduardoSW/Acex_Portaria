import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeToggle, type ThemeMode } from './components/ThemeToggle';

// Cada página é carregada sob demanda (code-splitting por rota): o bundle
// inicial fica pequeno e cada perfil baixa só as telas que realmente usa.
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const DoormanHome = lazy(() => import('./pages/DoormanHome').then((m) => ({ default: m.DoormanHome })));
const NewPackage = lazy(() => import('./pages/NewPackage').then((m) => ({ default: m.NewPackage })));
const PendingPackages = lazy(() => import('./pages/PendingPackages').then((m) => ({ default: m.PendingPackages })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminPackages = lazy(() => import('./pages/AdminPackages').then((m) => ({ default: m.AdminPackages })));
const AdminResidents = lazy(() => import('./pages/AdminResidents').then((m) => ({ default: m.AdminResidents })));
const AdminUsers = lazy(() => import('./pages/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminPasswordResetRequests = lazy(() => import('./pages/AdminPasswordResetRequests').then((m) => ({ default: m.AdminPasswordResetRequests })));
const AdminSettings = lazy(() => import('./pages/AdminSettings').then((m) => ({ default: m.AdminSettings })));
const GeneralManagerDashboard = lazy(() => import('./pages/GeneralManagerDashboard').then((m) => ({ default: m.GeneralManagerDashboard })));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-acex-teal" />
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuração Necessária</h1>
        <p className="text-gray-600 mb-6">
          Para usar o Acex Portaria, você precisa configurar o Supabase no arquivo <code className="bg-gray-100 px-2 py-1 rounded text-sm">.env</code>.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-6">
          <li>Crie um projeto no <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase</a></li>
          <li>Copie o URL e a Chave Anônima do seu projeto</li>
          <li>Cole no arquivo <code className="bg-gray-100 px-2 py-1 rounded text-sm">.env</code></li>
          <li>Execute o SQL do arquivo <code className="bg-gray-100 px-2 py-1 rounded text-sm">supabase/schema-bootstrap.sql</code> no SQL Editor do Supabase</li>
        </ol>
        <div className="bg-gray-100 p-4 rounded-xl text-sm font-mono text-gray-800">
          <p>VITE_SUPABASE_URL=seu-url</p>
          <p>VITE_SUPABASE_ANON_KEY=sua-chave</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'general_manager' | 'admin' | 'doorman' }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  // A sessão de recuperação é autenticada pelo Supabase, mas precisa permanecer
  // nesta rota até o usuário definir a nova senha.
  if (window.location.pathname === '/redefinir-senha') {
    return (
      <Routes>
        <Route path="/redefinir-senha" element={<Login />} />
        <Route path="*" element={<Navigate to="/redefinir-senha" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    console.log('[App] No profile, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile.role !== requiredRole) {
    console.log('[App] Wrong role, redirecting to correct route');
    if (profile.role === 'general_manager') {
      return <Navigate to="/geral" replace />;
    } else if (profile.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/porteiro" replace />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { profile, loading } = useAuth();
  console.log('[App] AppRoutes rendering, profile:', profile, 'loading:', loading);

  if (loading) {
    return <PageLoader />;
  }

  if (profile?.role === 'general_manager') {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/geral" replace />} />
        <Route path="/" element={<Navigate to="/geral" replace />} />
        <Route
          path="/geral"
          element={
            <ProtectedRoute requiredRole="general_manager">
              <GeneralManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/geral" replace />} />
      </Routes>
    );
  } else if (profile?.role === 'admin') {
    console.log('[App] Admin user, showing admin routes');
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/encomendas"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPackages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/moradores"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminResidents />
            </ProtectedRoute>
          }
        />
        <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/solicitacoes"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPasswordResetRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/configuracoes"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSettings />
              </ProtectedRoute>
            }
          />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  } else if (profile?.role === 'doorman') {
    console.log('[App] Doorman user, showing doorman routes');
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/porteiro" replace />} />
        <Route path="/" element={<Navigate to="/porteiro" replace />} />
        <Route
          path="/porteiro"
          element={
            <ProtectedRoute requiredRole="doorman">
              <DoormanHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nova-encomenda"
          element={
            <ProtectedRoute requiredRole="doorman">
              <NewPackage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pendentes"
          element={
            <ProtectedRoute requiredRole="doorman">
              <PendingPackages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/historico"
          element={
            <ProtectedRoute requiredRole="doorman">
              <History />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/porteiro" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/planos" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem('acex-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    window.localStorage.setItem('acex-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const themeClassName = `${theme === 'dark' ? 'acex-dark' : 'acex-light'} min-h-screen`;
  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-key';

  if (!isSupabaseConfigured) {
    return <div className={themeClassName}><SetupScreen /><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>;
  }

  return (
    <div className={themeClassName}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </Router>
      </AuthProvider>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}

export default App;
