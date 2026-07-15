import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { DoormanHome } from './pages/DoormanHome';
import { NewPackage } from './pages/NewPackage';
import { PendingPackages } from './pages/PendingPackages';
import { History } from './pages/History';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminPackages } from './pages/AdminPackages';
import { AdminResidents } from './pages/AdminResidents';
import { AdminUsers } from './pages/AdminUsers';
import { AdminPasswordResetRequests } from './pages/AdminPasswordResetRequests';
import { AdminSettings } from './pages/AdminSettings';

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
          <li>Execute o SQL do arquivo <code className="bg-gray-100 px-2 py-1 rounded text-sm">supabase-migration.sql</code> no SQL Editor do Supabase</li>
        </ol>
        <div className="bg-gray-100 p-4 rounded-xl text-sm font-mono text-gray-800">
          <p>VITE_SUPABASE_URL=seu-url</p>
          <p>VITE_SUPABASE_ANON_KEY=sua-chave</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'admin' | 'doorman' }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    console.log('[App] No profile, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile.role !== requiredRole) {
    console.log('[App] Wrong role, redirecting to correct route');
    if (profile.role === 'admin') {
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.role === 'admin') {
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
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-key';

  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
