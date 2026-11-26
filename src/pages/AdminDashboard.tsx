import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogOut,
  Package,
  Settings,
  TrendingUp,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { AcexCredit, AcexLogo } from '../components/AcexLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type RecentPackage = {
  id: string;
  status: 'pending' | 'delivered';
  created_at: string;
  delivered_at: string | null;
  resident: { name: string; block: string; apartment: string } | null;
};

type AdminStats = {
  today: number;
  pending: number;
  deliveredToday: number;
  residents: number;
  activeUsers: number;
  passwordResetRequests: number;
  weekTotal: number;
  weekDelivered: number;
};

const initialStats: AdminStats = {
  today: 0,
  pending: 0,
  deliveredToday: 0,
  residents: 0,
  activeUsers: 0,
  passwordResetRequests: 0,
  weekTotal: 0,
  weekDelivered: 0,
};

export function AdminDashboard() {
  const [stats, setStats] = useState(initialStats);
  const [recentPackages, setRecentPackages] = useState<RecentPackage[]>([]);
  const [condominiumName, setCondominiumName] = useState('Seu condomínio');
  const [loading, setLoading] = useState(true);
  const { profile, signOut } = useAuth();

  useEffect(() => {
    if (!profile?.condominium_id) return;

    async function loadStats() {
      if (!profile?.condominium_id) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      const condominiumId = profile.condominium_id;

      const [
        todayResult,
        pendingResult,
        deliveredTodayResult,
        residentsResult,
        usersResult,
        resetResult,
        weekResult,
        weekDeliveredResult,
        recentResult,
        condominiumResult,
      ] = await Promise.all([
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString()),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).eq('status', 'pending'),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).eq('status', 'delivered').gte('delivered_at', today.toISOString()).lt('delivered_at', tomorrow.toISOString()),
        supabase.from('residents').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).eq('status', 'active'),
        supabase.from('password_reset_requests').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).eq('status', 'pending'),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).gte('created_at', weekStart.toISOString()),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', condominiumId).eq('status', 'delivered').gte('created_at', weekStart.toISOString()),
        supabase.from('packages').select('id, status, created_at, delivered_at, resident:residents(name, block, apartment)').eq('condominium_id', condominiumId).order('created_at', { ascending: false }).limit(6),
        supabase.from('condominiums').select('name').eq('id', condominiumId).single(),
      ]);

      setStats({
        today: todayResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        deliveredToday: deliveredTodayResult.count ?? 0,
        residents: residentsResult.count ?? 0,
        activeUsers: usersResult.count ?? 0,
        passwordResetRequests: resetResult.count ?? 0,
        weekTotal: weekResult.count ?? 0,
        weekDelivered: weekDeliveredResult.count ?? 0,
      });
      setRecentPackages((recentResult.data ?? []) as unknown as RecentPackage[]);
      if (condominiumResult.data?.name) setCondominiumName(condominiumResult.data.name);
      setLoading(false);
    }

    loadStats();
    const packagesChannel = supabase.channel('syndic-dashboard-packages').on('postgres_changes', { event: '*', schema: 'public', table: 'packages', filter: `condominium_id=eq.${profile.condominium_id}` }, loadStats).subscribe();
    return () => { supabase.removeChannel(packagesChannel); };
  }, [profile]);

  const deliveryRate = useMemo(() => stats.weekTotal ? Math.round((stats.weekDelivered / stats.weekTotal) * 100) : 0, [stats]);

  return (
    <div className="min-h-screen bg-[#f5f8f8]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <AcexLogo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-black text-acex-ink">{profile?.name}</p><p className="text-xs text-slate-400">Síndico / Administrador</p></div>
            <button onClick={signOut} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm font-black uppercase tracking-[0.16em] text-acex-teal">Painel do síndico</p><h1 className="mt-2 text-3xl font-black tracking-tight text-acex-navy">{condominiumName}</h1><p className="mt-2 text-slate-500">Acompanhe a operação, a equipe e os moradores em um só lugar.</p></div>
          <div className="flex gap-3"><Link to="/admin/encomendas" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-acex-navy hover:border-acex-teal">Ver encomendas</Link><Link to="/admin/configuracoes" className="grid h-11 w-11 place-items-center rounded-xl bg-acex-navy text-white hover:bg-acex-teal" aria-label="Configurações"><Settings className="h-5 w-5" /></Link></div>
        </section>

        <section className="acex-stagger mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Recebidas hoje', value: stats.today, helper: `${stats.deliveredToday} entregues hoje`, icon: Package, accent: 'bg-sky-50 text-sky-600', to: '/admin/encomendas?filter=today' },
            { label: 'Aguardando retirada', value: stats.pending, helper: 'Encomendas na portaria', icon: Clock3, accent: 'bg-amber-50 text-amber-600', to: '/admin/encomendas?filter=pending' },
            { label: 'Moradores', value: stats.residents, helper: 'Cadastros no condomínio', icon: UsersRound, accent: 'bg-acex-mint text-acex-teal', to: '/admin/moradores' },
            { label: 'Equipe ativa', value: stats.activeUsers, helper: 'Síndicos e porteiros', icon: UserCog, accent: 'bg-violet-50 text-violet-600', to: '/admin/usuarios' },
          ].map(({ label, value, helper, icon: Icon, accent, to }) => (
            <Link key={label} to={to} className="acex-surface acex-interactive-card group p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-acex-ink">{loading ? '—' : value}</p></div><div className={`acex-icon-tile grid h-11 w-11 place-items-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></div></div><p className="mt-4 text-xs font-semibold text-slate-400">{helper}</p></Link>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <section className="acex-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-6"><div><h2 className="text-lg font-black text-acex-ink">Movimentações recentes</h2><p className="mt-1 text-sm text-slate-500">Últimas encomendas registradas.</p></div><Link to="/admin/encomendas" className="rounded-xl bg-acex-mint px-4 py-2 text-sm font-black text-acex-teal hover:bg-acex-teal hover:text-white">Ver histórico</Link></div>
            {recentPackages.length === 0 ? <div className="grid min-h-64 place-items-center text-sm text-slate-500">Nenhuma movimentação encontrada.</div> : <div className="divide-y divide-slate-100">{recentPackages.map((item) => <div key={item.id} className="flex items-center gap-4 px-6 py-4"><div className={`grid h-10 w-10 place-items-center rounded-xl ${item.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{item.status === 'delivered' ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-acex-ink">{item.resident?.name || 'Morador'}</p><p className="text-sm text-slate-400">{item.resident ? `Bloco ${item.resident.block} · ${item.resident.apartment}` : 'Unidade não informada'}</p></div><div className="text-right"><p className={`text-xs font-black ${item.status === 'delivered' ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status === 'delivered' ? 'Entregue' : 'Pendente'}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p></div></div>)}</div>}
          </section>

          <div className="space-y-5">
            <section className="rounded-3xl bg-acex-navy p-6 text-white shadow-acex"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-white/55">Eficiência nos últimos 7 dias</p><p className="mt-2 text-4xl font-black">{deliveryRate}%</p></div><div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-acex-lime"><TrendingUp className="h-6 w-6" /></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-acex-lime" style={{ width: `${deliveryRate}%` }} /></div><p className="mt-3 text-xs text-white/45">{stats.weekDelivered} de {stats.weekTotal} encomendas entregues</p></section>

            <section className="acex-surface p-5"><h2 className="font-black text-acex-ink">Gestão do condomínio</h2><div className="mt-4 space-y-2">
              <Link to="/admin/moradores" className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-acex-teal"><UsersRound className="h-5 w-5" />Gerenciar moradores</Link>
              <Link to="/admin/usuarios" className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-acex-teal"><UserCog className="h-5 w-5" />Gerenciar equipe</Link>
              <Link to="/admin/solicitacoes" className="flex items-center justify-between rounded-xl p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-acex-teal"><span className="flex items-center gap-3"><KeyRound className="h-5 w-5" />Solicitações de senha</span>{stats.passwordResetRequests > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-amber-500 px-1.5 text-xs text-white">{stats.passwordResetRequests}</span>}</Link>
              <Link to="/admin/configuracoes" className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-acex-teal"><Building2 className="h-5 w-5" />Dados do condomínio</Link>
            </div></section>
          </div>
        </div>
        <footer className="mt-10 border-t border-slate-200 pt-6 text-center"><AcexCredit /></footer>
      </main>
    </div>
  );
}
