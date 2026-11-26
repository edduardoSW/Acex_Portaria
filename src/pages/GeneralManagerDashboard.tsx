import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import { AcexCredit, AcexLogo } from '../components/AcexLogo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'cancelled';
type Plan = 'essential' | 'professional' | 'enterprise';
type ManagerView = 'overview' | 'condominiums' | 'subscriptions' | 'team';

type ManagedProfile = {
  id: string;
  name: string;
  email: string;
  role: 'general_manager' | 'admin' | 'doorman';
  status: 'active' | 'inactive';
  condominium_id: string | null;
};

type ManagedCondominium = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  units_count: number;
  plan: Plan;
  subscription_status: SubscriptionStatus;
  monthly_value: number;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  users_count: number;
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const statusLabels: Record<SubscriptionStatus, string> = {
  trial: 'Em teste',
  active: 'Ativo',
  overdue: 'Pagamento pendente',
  cancelled: 'Cancelado',
};

const planLabels: Record<Plan, string> = {
  essential: 'Essencial',
  professional: 'Profissional',
  enterprise: 'Enterprise',
};

const statusStyles: Record<SubscriptionStatus, string> = {
  trial: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-amber-50 text-amber-800 ring-amber-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function normalizeCondominium(row: Record<string, unknown>, usersCount = 0): ManagedCondominium {
  return {
    id: String(row.id),
    name: String(row.name),
    city: typeof row.city === 'string' ? row.city : null,
    state: typeof row.state === 'string' ? row.state : null,
    units_count: typeof row.units_count === 'number' ? row.units_count : 0,
    plan: ['essential', 'professional', 'enterprise'].includes(String(row.plan))
      ? (row.plan as Plan)
      : 'essential',
    subscription_status: ['trial', 'active', 'overdue', 'cancelled'].includes(String(row.subscription_status))
      ? (row.subscription_status as SubscriptionStatus)
      : 'trial',
    monthly_value: typeof row.monthly_value === 'number' ? row.monthly_value : 0,
    trial_ends_at: typeof row.trial_ends_at === 'string' ? row.trial_ends_at : null,
    next_billing_at: typeof row.next_billing_at === 'string' ? row.next_billing_at : null,
    contact_name: typeof row.contact_name === 'string' ? row.contact_name : null,
    contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
    created_at: String(row.created_at),
    users_count: usersCount,
  };
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="acex-surface acex-interactive-card group min-w-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate text-3xl font-black tracking-tight text-acex-ink">{value}</p>
        </div>
        <div className={`acex-icon-tile grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent}`}>{icon}</div>
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-400">{helper}</p>
    </div>
  );
}

export function GeneralManagerDashboard() {
  const { profile, signOut } = useAuth();
  const [condominiums, setCondominiums] = useState<ManagedCondominium[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | SubscriptionStatus>('all');
  const [showNewCondominium, setShowNewCondominium] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selected, setSelected] = useState<ManagedCondominium | null>(null);
  const [activeView, setActiveView] = useState<ManagerView>('overview');
  const [teamMembers, setTeamMembers] = useState<ManagedProfile[]>([]);

  const viewTitles: Record<ManagerView, string> = {
    overview: 'Visão geral',
    condominiums: 'Condomínios',
    subscriptions: 'Assinaturas',
    team: 'Equipe e acessos',
  };

  function changeView(view: ManagerView) {
    setActiveView(view);
    setMobileMenu(false);
    setSearch('');
    setStatus('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadCondominiums() {
    setLoading(true);
    setError('');

    const [{ data: condominiumRows, error: condominiumError }, { data: profiles }] = await Promise.all([
      supabase.from('condominiums').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, email, role, status, condominium_id').order('name'),
    ]);

    if (condominiumError) {
      setError('Não foi possível carregar os condomínios. Verifique se a migration do Gerenciador Geral foi aplicada.');
      setLoading(false);
      return;
    }

    const counts = (profiles ?? []).reduce<Record<string, number>>((acc, item) => {
      if (item.condominium_id) acc[item.condominium_id] = (acc[item.condominium_id] ?? 0) + 1;
      return acc;
    }, {});

    setTeamMembers((profiles ?? []) as ManagedProfile[]);

    setCondominiums(
      (condominiumRows ?? []).map((row) =>
        normalizeCondominium(row as unknown as Record<string, unknown>, counts[row.id] ?? 0),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    loadCondominiums();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return condominiums.filter((condominium) => {
      const matchesSearch =
        !term ||
        condominium.name.toLocaleLowerCase('pt-BR').includes(term) ||
        condominium.city?.toLocaleLowerCase('pt-BR').includes(term) ||
        condominium.contact_name?.toLocaleLowerCase('pt-BR').includes(term);
      const matchesStatus = status === 'all' || condominium.subscription_status === status;
      return matchesSearch && matchesStatus;
    });
  }, [condominiums, search, status]);

  const metrics = useMemo(() => {
    const active = condominiums.filter((item) => item.subscription_status === 'active').length;
    const trial = condominiums.filter((item) => item.subscription_status === 'trial').length;
    const overdue = condominiums.filter((item) => item.subscription_status === 'overdue').length;
    const mrr = condominiums
      .filter((item) => item.subscription_status === 'active')
      .reduce((total, item) => total + item.monthly_value, 0);
    return { active, trial, overdue, mrr };
  }, [condominiums]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const units = Number(form.get('units_count')) || 0;
    const plan = String(form.get('plan')) as Plan;
    const valueByPlan: Record<Plan, number> = { essential: 199, professional: 349, enterprise: 599 };

    const { error: insertError } = await supabase.from('condominiums').insert({
      name: String(form.get('name')).trim(),
      city: String(form.get('city')).trim() || null,
      state: String(form.get('state')).trim().toUpperCase() || null,
      units_count: units,
      plan,
      monthly_value: valueByPlan[plan],
      subscription_status: 'trial',
      contact_name: String(form.get('contact_name')).trim() || null,
      contact_email: String(form.get('contact_email')).trim().toLowerCase() || null,
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

    if (insertError) {
      setError(`Não foi possível cadastrar: ${insertError.message}`);
      setSaving(false);
      return;
    }

    setShowNewCondominium(false);
    setSaving(false);
    await loadCondominiums();
  }

  return (
    <div className="min-h-screen bg-acex-cream lg:grid lg:grid-cols-[248px_1fr]">
      <aside
        className={`${mobileMenu ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-acex-navy px-5 py-6 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
      >
        <div className="flex items-center justify-between">
          <AcexLogo inverse />
          <button className="rounded-lg p-2 text-white/70 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Ambiente</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-acex-lime text-sm font-black text-acex-navy">GG</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Gerenciador geral</p>
              <p className="truncate text-xs text-white/50">{profile?.email}</p>
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-1" aria-label="Navegação principal">
          {([
            ['overview', 'Visão geral', LayoutDashboard],
            ['condominiums', 'Condomínios', Building2],
            ['subscriptions', 'Assinaturas', CreditCard],
            ['team', 'Equipe e acessos', UsersRound],
          ] as const).map(([view, label, Icon]) => (
            <button
              key={view}
              type="button"
              onClick={() => changeView(view)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                activeView === view ? 'bg-white font-black text-acex-navy' : 'font-semibold text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-white/10 pt-5">
          <div className="px-3 pb-3"><AcexCredit inverse /></div>
          <button type="button" onClick={() => window.alert('Para suporte, envie um e-mail para a equipe ACEX responsável pela sua conta.')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white">
            <CircleHelp className="h-5 w-5" /> Central de ajuda
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white">
            <LogOut className="h-5 w-5" /> Sair
          </button>
        </div>
      </aside>

      {mobileMenu && <button className="fixed inset-0 z-30 bg-acex-navy/50 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur md:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-slate-200 p-2.5 text-acex-navy lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-acex-teal">Operação ACEX</p>
              <h1 className="text-lg font-black text-acex-ink sm:text-xl">{viewTitles[activeView]}</h1>
            </div>
          </div>
          <button
            onClick={() => setShowNewCondominium(true)}
            className="flex h-11 items-center gap-2 rounded-xl bg-acex-teal px-4 text-sm font-bold text-acex-navy shadow-lg shadow-acex-teal/15 transition hover:bg-[#d56529]"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo condomínio</span><span className="sm:hidden">Novo</span>
          </button>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 md:p-8 lg:p-10" id="visao-geral">
          {activeView === 'overview' && <section className="relative overflow-hidden rounded-3xl bg-acex-navy p-6 text-white shadow-acex md:p-8">
            <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border-[48px] border-white/[0.04]" />
            <div className="relative max-w-2xl">
              <span className="inline-flex rounded-full bg-acex-lime px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-acex-navy">
                Central de operações
              </span>
              <h2 className="mt-5 text-2xl font-black tracking-tight md:text-3xl">Sua carteira de condomínios, clara e sob controle.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 md:text-base">
                Acompanhe adesões, períodos de teste, recorrência e pendências em um único lugar.
              </p>
            </div>
          </section>}

          {activeView !== 'team' && <section className={`${activeView === 'overview' ? 'mt-6' : ''} acex-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`} aria-label="Indicadores">
            <MetricCard label="Condomínios" value={String(condominiums.length)} helper="Total na carteira" icon={<Building2 className="h-5 w-5" />} accent="bg-acex-mint text-acex-teal" />
            <MetricCard label="Assinaturas ativas" value={String(metrics.active)} helper={`${metrics.trial} em período de teste`} icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600" />
            <MetricCard label="Receita mensal" value={currency.format(metrics.mrr)} helper="Receita recorrente estimada" icon={<CreditCard className="h-5 w-5" />} accent="bg-sky-50 text-sky-600" />
            <MetricCard label="Atenção necessária" value={String(metrics.overdue)} helper="Pagamentos pendentes" icon={<AlertTriangle className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
          </section>}

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {activeView === 'team' ? (
            <section className="acex-surface overflow-hidden">
              <div className="border-b border-slate-100 p-6">
                <h2 className="text-xl font-black text-acex-ink">Equipe e acessos</h2>
                <p className="mt-1 text-sm text-slate-500">Visão consolidada dos administradores e porteiros de toda a carteira.</p>
              </div>
              {teamMembers.length === 0 ? (
                <div className="grid min-h-64 place-items-center text-sm text-slate-500">Nenhum usuário encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <tr><th className="px-6 py-4">Usuário</th><th className="px-4 py-4">Perfil</th><th className="px-4 py-4">Condomínio</th><th className="px-4 py-4">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMembers.map((member) => {
                        const condominium = condominiums.find((item) => item.id === member.condominium_id);
                        return (
                          <tr key={member.id} className="hover:bg-slate-50/70">
                            <td className="px-6 py-4"><p className="font-bold text-acex-ink">{member.name}</p><p className="text-sm text-slate-400">{member.email}</p></td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-600">{member.role === 'general_manager' ? 'Gerenciador geral' : member.role === 'admin' ? 'Síndico / Admin' : 'Porteiro'}</td>
                            <td className="px-4 py-4 text-sm text-slate-500">{condominium?.name || 'Equipe ACEX'}</td>
                            <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
          <section className="acex-surface mt-6 overflow-hidden" id="condominios">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="text-lg font-black text-acex-ink">{activeView === 'subscriptions' ? 'Assinaturas' : 'Condomínios'}</h2>
                <p className="mt-1 text-sm text-slate-500">{activeView === 'subscriptions' ? 'Planos, valores e situação de cobrança da carteira.' : 'Clientes, planos e situação comercial.'}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block sm:w-64">
                  <span className="sr-only">Buscar condomínio</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} className="acex-input pl-10" placeholder="Buscar condomínio..." />
                </label>
                <label className="relative block sm:w-48">
                  <span className="sr-only">Filtrar por status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="acex-input appearance-none pr-9">
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="trial">Em teste</option>
                    <option value="overdue">Pendentes</option>
                    <option value="cancelled">Cancelados</option>
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">⌄</span>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-72 place-items-center">
                <div className="text-center text-slate-500">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-acex-teal" />
                  <p className="mt-3 text-sm font-medium">Carregando carteira...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acex-mint text-acex-teal"><Building2 className="h-6 w-6" /></div>
                  <h3 className="mt-4 font-black text-acex-ink">Nenhum condomínio encontrado</h3>
                  <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou cadastre o primeiro cliente.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-[0.09em] text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Condomínio</th>
                      <th className="px-4 py-4">Plano</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Estrutura</th>
                      <th className="px-4 py-4">Próxima cobrança</th>
                      <th className="px-4 py-4">Mensalidade</th>
                      <th className="px-5 py-4"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((condominium) => (
                      <tr key={condominium.id} className="group transition hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <button className="flex items-center gap-3 text-left" onClick={() => setSelected(condominium)}>
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acex-mint font-black text-acex-teal">
                              {condominium.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-acex-ink group-hover:text-acex-teal">{condominium.name}</p>
                              <p className="mt-0.5 text-xs text-slate-400">{[condominium.city, condominium.state].filter(Boolean).join(' · ') || 'Localização não informada'}</p>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-600">{planLabels[condominium.plan]}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[condominium.subscription_status]}`}>
                            {statusLabels[condominium.subscription_status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">
                          <strong className="font-bold text-acex-ink">{condominium.units_count}</strong> unidades · {condominium.users_count} usuários
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">
                          {condominium.next_billing_at ? shortDate.format(new Date(condominium.next_billing_at)) : condominium.trial_ends_at ? `Teste até ${shortDate.format(new Date(condominium.trial_ends_at))}` : 'A definir'}
                        </td>
                        <td className="px-4 py-4 text-sm font-black text-acex-ink">{currency.format(condominium.monthly_value)}</td>
                        <td className="px-5 py-4">
                          <button onClick={() => setSelected(condominium)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-acex-teal" aria-label={`Ver ${condominium.name}`}>
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
              <span>{filtered.length} de {condominiums.length} condomínios</span>
              <span className="font-semibold text-acex-teal">Carteira ACEX</span>
            </div>
          </section>
          )}
        </div>
      </main>

      {showNewCondominium && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-acex-navy/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-condominium-title">
          <form onSubmit={handleCreate} className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-acex-teal">Nova adesão</p>
                <h2 id="new-condominium-title" className="mt-1 text-xl font-black text-acex-ink">Cadastrar condomínio</h2>
                <p className="mt-1 text-sm text-slate-500">O cliente começa com 15 dias de teste gratuito.</p>
              </div>
              <button type="button" onClick={() => setShowNewCondominium(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-acex-ink">Nome do condomínio</span>
                <input name="name" required className="acex-input" placeholder="Ex.: Residencial Jardim do Mar" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">Cidade</span>
                <input name="city" className="acex-input" placeholder="Vitória" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">UF</span>
                <input name="state" maxLength={2} className="acex-input uppercase" placeholder="ES" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">Quantidade de unidades</span>
                <input name="units_count" required min="1" type="number" className="acex-input" placeholder="120" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">Plano</span>
                <select name="plan" className="acex-input appearance-none">
                  <option value="essential">Essencial · R$ 199</option>
                  <option value="professional">Profissional · R$ 349</option>
                  <option value="enterprise">Enterprise · R$ 599</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">Contato responsável</span>
                <input name="contact_name" className="acex-input" placeholder="Nome do síndico" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-acex-ink">E-mail do contato</span>
                <input name="contact_email" type="email" className="acex-input" placeholder="sindico@condominio.com.br" />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/70 p-5">
              <button type="button" onClick={() => setShowNewCondominium(false)} className="h-11 rounded-xl px-5 text-sm font-bold text-slate-600 hover:bg-slate-200/70">Cancelar</button>
              <button disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-acex-teal px-5 text-sm font-bold text-acex-navy disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar condomínio
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-acex-navy/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.name}`}>
          <button className="h-full flex-1 cursor-default" onClick={() => setSelected(null)} aria-label="Fechar detalhes" />
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[selected.subscription_status]}`}>{statusLabels[selected.subscription_status]}</span>
              <button onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-acex-navy text-lg font-black text-white">{selected.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <h2 className="text-xl font-black text-acex-ink">{selected.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{[selected.city, selected.state].filter(Boolean).join(' · ') || 'Localização não informada'}</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Unidades</p><p className="mt-2 text-xl font-black text-acex-ink">{selected.units_count}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Usuários</p><p className="mt-2 text-xl font-black text-acex-ink">{selected.users_count}</p></div>
            </div>
            <div className="mt-8 space-y-5 border-t border-slate-100 pt-7">
              <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-acex-teal" /><div><p className="text-xs text-slate-400">Plano e valor</p><p className="font-bold text-acex-ink">{planLabels[selected.plan]} · {currency.format(selected.monthly_value)}/mês</p></div></div>
              <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-acex-teal" /><div><p className="text-xs text-slate-400">Próxima cobrança</p><p className="font-bold text-acex-ink">{selected.next_billing_at ? shortDate.format(new Date(selected.next_billing_at)) : 'Ainda não agendada'}</p></div></div>
              <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-acex-teal" /><div><p className="text-xs text-slate-400">Contato</p><p className="font-bold text-acex-ink">{selected.contact_name || 'Não informado'}</p><p className="text-sm text-slate-500">{selected.contact_email}</p></div></div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
