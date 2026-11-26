import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, History, LogOut, Package, Plus, UserRound } from 'lucide-react';
import { AcexLogo } from '../components/AcexLogo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type RecentPackage = {
  id: string;
  created_at: string;
  resident: { name: string; block: string; apartment: string } | null;
};

export function DoormanHome() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState({ today: 0, pending: 0, delivered: 0 });
  const [recent, setRecent] = useState<RecentPackage[]>([]);

  useEffect(() => {
    if (!profile?.condominium_id) return;

    async function loadDashboard() {
      if (!profile?.condominium_id) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayResult, pendingResult, deliveredResult, recentResult] = await Promise.all([
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', profile.condominium_id).gte('created_at', today.toISOString()),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', profile.condominium_id).eq('status', 'pending'),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('condominium_id', profile.condominium_id).eq('status', 'delivered').gte('delivered_at', today.toISOString()),
        supabase.from('packages').select('id, created_at, resident:residents(name, block, apartment)').eq('condominium_id', profile.condominium_id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({ today: todayResult.count ?? 0, pending: pendingResult.count ?? 0, delivered: deliveredResult.count ?? 0 });
      setRecent((recentResult.data ?? []) as unknown as RecentPackage[]);
    }

    loadDashboard();
    const channel = supabase.channel('doorman-home-packages').on('postgres_changes', { event: '*', schema: 'public', table: 'packages', filter: `condominium_id=eq.${profile.condominium_id}` }, loadDashboard).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="min-h-screen bg-[#f5f8f8]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <AcexLogo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-black text-acex-ink">{profile?.name}</p><p className="text-xs text-slate-400">Portaria</p></div>
            <button onClick={signOut} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-acex-navy p-6 text-white shadow-acex sm:p-8">
          <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border-[42px] border-white/[0.04]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div><p className="text-sm font-bold text-acex-lime">{greeting}, {profile?.name?.split(' ')[0]}.</p><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Sua portaria está pronta para o dia.</h1><p className="mt-2 text-white/55">Registre chegadas e acompanhe tudo o que ainda aguarda retirada.</p></div>
            <Link to="/nova-encomenda" className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-acex-lime px-6 font-black text-acex-navy hover:bg-white"><Plus className="h-5 w-5" />Registrar encomenda</Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Recebidas hoje', value: stats.today, icon: Package, color: 'bg-sky-50 text-sky-600' },
            { label: 'Aguardando retirada', value: stats.pending, icon: Clock3, color: 'bg-amber-50 text-amber-600' },
            { label: 'Entregues hoje', value: stats.delivered, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="acex-surface flex items-center gap-4 p-5"><div className={`grid h-12 w-12 place-items-center rounded-xl ${color}`}><Icon className="h-6 w-6" /></div><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-acex-ink">{value}</p></div></div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="acex-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6"><div><h2 className="text-lg font-black text-acex-ink">Aguardando retirada</h2><p className="mt-1 text-sm text-slate-500">Últimas encomendas pendentes.</p></div><Link to="/pendentes" className="rounded-xl bg-acex-mint px-4 py-2 text-sm font-black text-acex-teal hover:bg-acex-teal hover:text-white">Ver todas</Link></div>
            {recent.length === 0 ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 font-black text-acex-ink">Tudo em dia</p><p className="mt-1 text-sm text-slate-500">Nenhuma encomenda aguardando retirada.</p></div></div> : <div className="divide-y divide-slate-100">{recent.map((item) => <div key={item.id} className="flex items-center gap-4 px-5 py-4 sm:px-6"><div className="grid h-10 w-10 place-items-center rounded-xl bg-acex-mint text-acex-teal"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-bold text-acex-ink">{item.resident?.name || 'Morador'}</p><p className="text-sm text-slate-400">{item.resident ? `Bloco ${item.resident.block} · ${item.resident.apartment}` : 'Unidade não informada'}</p></div><div className="text-right"><p className="text-sm font-bold text-slate-600">{new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p><p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p></div></div>)}</div>}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-black text-acex-ink">Ações rápidas</h2>
            <Link to="/nova-encomenda" className="acex-surface flex items-center gap-4 p-5 transition hover:border-acex-teal"><div className="grid h-12 w-12 place-items-center rounded-xl bg-acex-teal text-white"><Plus className="h-6 w-6" /></div><div><p className="font-black text-acex-ink">Nova encomenda</p><p className="text-sm text-slate-500">Registrar uma chegada</p></div></Link>
            <Link to="/pendentes" className="acex-surface flex items-center gap-4 p-5 transition hover:border-acex-teal"><div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600"><Clock3 className="h-6 w-6" /></div><div><p className="font-black text-acex-ink">Pendentes</p><p className="text-sm text-slate-500">Dar baixa em uma retirada</p></div></Link>
            <Link to="/historico" className="acex-surface flex items-center gap-4 p-5 transition hover:border-acex-teal"><div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-600"><History className="h-6 w-6" /></div><div><p className="font-black text-acex-ink">Histórico</p><p className="text-sm text-slate-500">Consultar movimentações</p></div></Link>
          </section>
        </div>
      </main>
    </div>
  );
}
