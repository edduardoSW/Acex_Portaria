import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Users, Settings, LogOut, ListTodo, CheckCircle, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    today: 0,
    pending: 0,
    deliveredToday: 0,
    passwordResetRequests: 0,
  });
  const { profile, signOut } = useAuth();

  useEffect(() => {
    async function loadStats() {
      if (!profile) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Total packages today
      const { count: todayCount } = await supabase
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', profile.condominium_id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      // Pending packages
      const { count: pendingCount } = await supabase
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', profile.condominium_id)
        .eq('status', 'pending');

      // Delivered today
      const { count: deliveredTodayCount } = await supabase
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', profile.condominium_id)
        .eq('status', 'delivered')
        .gte('delivered_at', today.toISOString())
        .lt('delivered_at', tomorrow.toISOString());

      // Pending password reset requests
      const { count: resetRequestCount } = await supabase
        .from('password_reset_requests')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', profile.condominium_id)
        .eq('status', 'pending');

      setStats({
        today: todayCount || 0,
        pending: pendingCount || 0,
        deliveredToday: deliveredTodayCount || 0,
        passwordResetRequests: resetRequestCount || 0,
      });
    }

    loadStats();

    if (!profile) return;

    // Set up real-time subscriptions
    const packagesChannel = supabase
      .channel('public:packages-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packages',
          filter: `condominium_id=eq.${profile.condominium_id}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    const resetRequestsChannel = supabase
      .channel('public:password-reset-requests-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'password_reset_requests',
          filter: `condominium_id=eq.${profile.condominium_id}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(packagesChannel);
      supabase.removeChannel(resetRequestsChannel);
    };
  }, [profile]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/admin/encomendas?filter=today"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Encomendas Hoje</p>
                <p className="text-3xl font-bold text-gray-900">{stats.today}</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/encomendas?filter=pending"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <ListTodo className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Pendentes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/encomendas?filter=delivered-today"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Entregues Hoje</p>
                <p className="text-3xl font-bold text-gray-900">{stats.deliveredToday}</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            to="/admin/moradores"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Moradores</h2>
                <p className="text-gray-500 text-sm">Gerenciar moradores</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/usuarios"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Usuários</h2>
                <p className="text-gray-500 text-sm">Gerenciar usuários</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/solicitacoes"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Key className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">Redefinição de Senha</h2>
                <p className="text-gray-500 text-sm">
                  {stats.passwordResetRequests > 0 
                    ? `${stats.passwordResetRequests} solicitação${stats.passwordResetRequests > 1 ? 's' : ''} pendente${stats.passwordResetRequests > 1 ? 's' : ''}` 
                    : 'Gerenciar solicitações'
                  }
                </p>
              </div>
              {stats.passwordResetRequests > 0 && (
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{stats.passwordResetRequests}</span>
                </div>
              )}
            </div>
          </Link>

          <Link
            to="/admin/configuracoes"
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Configurações</h2>
                <p className="text-gray-500 text-sm">Configurar sistema</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
