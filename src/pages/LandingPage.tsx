import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Loader2,
  Menu,
  PackageCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AcexCredit, AcexLogo } from '../components/AcexLogo';

type PlanKey = 'essential' | 'professional' | 'enterprise' | 'custom';

type Plan = {
  key: PlanKey;
  name: string;
  range: string;
  price: number | null;
  description: string;
  features: string[];
  featured?: boolean;
};

const plans: Plan[] = [
  {
    key: 'essential',
    name: 'Essencial',
    range: 'Até 150 unidades',
    price: 199,
    description: 'Para condomínios que querem organizar a portaria sem complicação.',
    features: ['Cadastro de moradores', 'Controle de encomendas', 'Avisos aos moradores', 'Histórico de retiradas'],
  },
  {
    key: 'professional',
    name: 'Profissional',
    range: 'De 151 a 350 unidades',
    price: 349,
    description: 'Mais capacidade para operações com maior volume e mais usuários.',
    features: ['Tudo do Essencial', 'Múltiplos porteiros', 'Códigos de retirada', 'Painel administrativo completo'],
    featured: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    range: 'De 351 a 600 unidades',
    price: 599,
    description: 'Estrutura completa para grandes condomínios e operações intensas.',
    features: ['Tudo do Profissional', 'Maior volume operacional', 'Gestão avançada de acessos', 'Atendimento prioritário'],
  },
];

const implementationSteps = [
  { title: 'Mapeamos', text: 'Entendemos unidades, equipe e fluxo atual da portaria.' },
  { title: 'Configuramos', text: 'Organizamos perfis, moradores e regras do condomínio.' },
  { title: 'Acompanhamos', text: 'A equipe começa a operar com suporte na implantação.' },
];

function calculatePlan(units: number): Plan {
  if (units <= 150) return plans[0];
  if (units <= 350) return plans[1];
  if (units <= 600) return plans[2];
  return {
    key: 'custom',
    name: 'Personalizado',
    range: 'Acima de 600 unidades',
    price: null,
    description: 'Uma proposta desenhada para a estrutura e o volume da sua operação.',
    features: ['Escala personalizada', 'Implantação assistida', 'Condições comerciais sob medida'],
  };
}

function scrollToLead(units?: number) {
  if (units) {
    window.dispatchEvent(new CustomEvent('acex:set-units', { detail: units }));
  }
  document.getElementById('simulacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingPage() {
  const [units, setUnits] = useState(120);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const selectedPlan = useMemo(() => calculatePlan(units), [units]);

  useEffect(() => {
    const handleUnits = (event: Event) => setUnits((event as CustomEvent<number>).detail);
    window.addEventListener('acex:set-units', handleUnits);
    return () => window.removeEventListener('acex:set-units', handleUnits);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setActiveStep((current) => (current + 1) % implementationSteps.length), 2400);
    return () => window.clearInterval(interval);
  }, []);

  async function handleLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setSent(false);
    setError('');

    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/send_sales_lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        name: String(form.get('name') ?? '').trim(),
        condominium: String(form.get('condominium') ?? '').trim(),
        email: String(form.get('email') ?? '').trim().toLowerCase(),
        phone: String(form.get('phone') ?? '').trim(),
        units,
        message: String(form.get('message') ?? '').trim(),
          website: String(form.get('website') ?? ''),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) throw new Error(data?.error || 'Não foi possível enviar agora.');

      setSent(true);
      formElement.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível enviar agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-acex-cream text-acex-ink">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-acex-navy/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#inicio" aria-label="ACEX Portaria - início"><AcexLogo inverse /></a>
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação da página">
            <a href="#solucao" className="text-sm font-bold text-acex-taupe hover:text-acex-teal">Solução</a>
            <a href="#como-funciona" className="text-sm font-bold text-acex-taupe hover:text-acex-teal">Como funciona</a>
            <a href="#planos" className="text-sm font-bold text-acex-taupe hover:text-acex-teal">Planos</a>
            <a href="#duvidas" className="text-sm font-bold text-acex-taupe hover:text-acex-teal">Dúvidas</a>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="rounded-xl px-4 py-3 text-sm font-black text-white hover:bg-white/10">Entrar</Link>
            <button onClick={() => scrollToLead()} className="rounded-xl bg-acex-teal px-5 py-3 text-sm font-black text-acex-navy shadow-lg shadow-acex-teal/15 hover:bg-[#d56529]">Simular meu plano</button>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="rounded-xl border border-white/15 p-2.5 text-white lg:hidden" aria-label={mobileMenu ? 'Fechar menu' : 'Abrir menu'}>
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/10 bg-acex-navy px-5 py-5 lg:hidden">
            <nav className="grid gap-1">
              {['solucao', 'como-funciona', 'planos', 'duvidas'].map((item) => (
                <a key={item} href={`#${item}`} onClick={() => setMobileMenu(false)} className="rounded-xl px-3 py-3 font-bold capitalize text-acex-taupe hover:bg-white/10 hover:text-white">{item.replace('-', ' ')}</a>
              ))}
              <Link to="/login" className="mt-2 rounded-xl border border-white/15 px-4 py-3 text-center font-black text-white">Entrar no sistema</Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section id="inicio" className="relative overflow-hidden bg-acex-navy pb-20 pt-32 text-white sm:pt-40 lg:pb-28">
          <div className="absolute right-0 top-20 h-[560px] w-[35%] bg-acex-teal/[0.05]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-acex-cream sm:text-5xl lg:text-6xl">
                Encomendas sob controle. <span className="text-acex-teal">Portaria sem ruído.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-acex-taupe">
                A ACEX conecta portaria, moradores e administração para cada encomenda chegar ao destino certo, com registro e rastreabilidade.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => scrollToLead()} className="h-14 rounded-xl bg-acex-teal px-7 text-base font-black text-acex-navy shadow-xl shadow-black/20 hover:bg-[#d56529]">Calcular investimento</button>
                <a href="#como-funciona" className="grid h-14 place-items-center rounded-xl border border-white/15 px-7 text-base font-black text-white hover:border-acex-teal hover:text-acex-teal">Conhecer a solução</a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rotate-2 rounded-[2rem] bg-acex-teal" />
              <div className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-acex-panel p-4 shadow-2xl sm:p-6">
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#211c19] p-4 shadow-sm">
                  <div><p className="font-black tracking-wide text-white">ACEX PORTARIA</p><p className="text-xs text-acex-taupe">by ACEX Partners · operação em tempo real</p></div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Online</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[['Hoje', '18'], ['Pendentes', '7'], ['Entregues', '11']].map(([label, value], index) => (
                    <div key={label} className={`rounded-2xl border border-white/5 p-4 ${index === 1 ? 'bg-acex-teal text-acex-navy' : 'bg-[#211c19] text-white'}`}><p className={`text-xs font-bold ${index === 1 ? 'text-acex-navy/60' : 'text-acex-taupe'}`}>{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-white/5 bg-[#211c19] p-5">
                  <div className="flex items-center justify-between"><p className="font-black text-white">Últimas encomendas</p><span className="text-xs font-bold text-acex-teal">Atualizado agora</span></div>
                  <div className="mt-4 space-y-3">
                    {[['MA', 'Marina Alves', 'Bloco B · 204', 'Avisado'], ['RS', 'Rafael Souza', 'Torre 1 · 803', 'Pendente'], ['CL', 'Carla Lima', 'Bloco A · 102', 'Retirado']].map(([initials, name, unit, state], index) => (
                      <div key={name} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-acex-teal/15 text-xs font-black text-acex-teal">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{name}</p><p className="text-xs text-acex-taupe">{unit}</p></div><span className={`text-xs font-bold ${index === 1 ? 'text-amber-500' : index === 2 ? 'text-acex-taupe' : 'text-acex-teal'}`}>{state}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="solucao" className="bg-acex-cream py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-acex-teal">Uma rotina que flui</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-acex-navy sm:text-4xl">Da chegada à retirada, tudo registrado.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">Menos papel, menos recados perdidos e mais clareza para quem trabalha e para quem mora.</p>
            </div>
            <div className="acex-stagger mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: PackageCheck, title: 'Registro rápido', text: 'A portaria registra a encomenda e identifica o morador em poucos passos.' },
                { icon: BellRing, title: 'Aviso ao morador', text: 'O sistema organiza o envio das notificações e o acompanhamento.' },
                { icon: KeyRound, title: 'Retirada segura', text: 'Códigos ajudam a validar a entrega e manter o histórico correto.' },
                { icon: ShieldCheck, title: 'Gestão centralizada', text: 'Administradores acompanham a operação e os acessos do condomínio.' },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="acex-card-animate acex-interactive-card group rounded-3xl border border-slate-200/70 bg-white p-6 shadow-acex">
                  <div className="acex-icon-tile grid h-12 w-12 place-items-center rounded-2xl bg-acex-mint text-acex-teal"><Icon className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-black text-acex-navy">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="bg-acex-navy py-20 text-white lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-acex-lime">Comece sem complicação</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Uma implantação pensada para a rotina real.</h2>
              <p className="mt-5 text-lg leading-8 text-white/60">A estrutura acompanha o tamanho do condomínio e pode crescer junto com a operação.</p>
            </div>
            <div className="relative grid gap-4 sm:grid-cols-3">
              <div className="absolute left-[16.66%] right-[16.66%] top-[22px] hidden h-0.5 overflow-hidden bg-white/10 sm:block"><div className="h-full bg-acex-lime transition-all duration-700" style={{ width: `${(activeStep / 2) * 100}%` }} /></div>
              {implementationSteps.map(({ title, text }, index) => (
                <button type="button" onClick={() => setActiveStep(index)} key={title} className={`relative rounded-3xl border p-6 text-left transition-all duration-700 ${activeStep === index ? 'z-10 -translate-y-2 border-acex-lime/60 bg-white/[0.13] shadow-2xl shadow-black/15' : 'border-white/10 bg-white/[0.05] opacity-60 hover:opacity-90'}`}>
                  <span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-black transition-all duration-500 ${activeStep === index ? 'acex-step-pulse scale-110 bg-acex-lime text-acex-navy' : 'bg-white/10 text-white/60'}`}>{index + 1}</span>
                  <h3 className={`mt-6 text-lg font-black transition-colors ${activeStep === index ? 'text-white' : 'text-white/70'}`}>{title}</h3>
                  <p className={`mt-3 leading-7 transition-colors ${activeStep === index ? 'text-white/70' : 'text-white/40'}`}>{text}</p>
                  <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full bg-acex-lime transition-all duration-[2200ms] ease-linear ${activeStep === index ? 'w-full' : 'w-0'}`} /></div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="bg-[#fbf8f4] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-acex-teal">Planos transparentes</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-acex-navy sm:text-4xl">Um plano para cada tamanho de condomínio.</h2>
              <p className="mt-4 text-lg text-slate-600">Todos os planos incluem implantação assistida e 14 dias para experimentar.</p>
            </div>
            <div className="acex-stagger mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article key={plan.key} className={`acex-card-animate acex-interactive-card relative flex flex-col rounded-3xl border p-7 ${plan.featured ? 'border-acex-teal bg-acex-navy text-white shadow-2xl shadow-acex-navy/15' : 'border-slate-200 bg-white shadow-acex'}`}>
                  {plan.featured && <span className="absolute right-6 top-0 -translate-y-1/2 rounded-full bg-acex-lime px-3 py-1 text-xs font-black uppercase tracking-wider text-acex-navy">Mais escolhido</span>}
                  <p className={`text-sm font-black uppercase tracking-[0.14em] ${plan.featured ? 'text-acex-lime' : 'text-acex-teal'}`}>{plan.name}</p>
                  <p className={`mt-2 text-sm font-bold ${plan.featured ? 'text-white/55' : 'text-slate-500'}`}>{plan.range}</p>
                  <div className="mt-6 flex items-end gap-2"><span className="text-4xl font-black tracking-tight">R$ {plan.price}</span><span className={`pb-1 text-sm ${plan.featured ? 'text-white/50' : 'text-slate-400'}`}>/mês</span></div>
                  <p className={`mt-5 min-h-14 leading-7 ${plan.featured ? 'text-white/60' : 'text-slate-500'}`}>{plan.description}</p>
                  <ul className="mt-7 flex-1 space-y-3">
                    {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm font-semibold"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-acex-lime' : 'text-acex-teal'}`} />{feature}</li>)}
                  </ul>
                  <button onClick={() => scrollToLead(plan.key === 'essential' ? 150 : plan.key === 'professional' ? 350 : 600)} className={`mt-8 h-12 rounded-xl text-sm font-black ${plan.featured ? 'bg-acex-lime text-acex-navy hover:bg-white' : 'bg-acex-teal text-acex-navy hover:bg-acex-navy hover:text-white'}`}>Escolher {plan.name}</button>
                </article>
              ))}
            </div>
            <div className="mt-5 flex flex-col items-center justify-between gap-5 rounded-3xl border border-[#dfd5cb] bg-acex-cream p-6 text-center sm:flex-row sm:text-left">
              <div><p className="font-black text-acex-navy">Mais de 600 unidades?</p><p className="mt-1 text-slate-500">Criamos uma proposta personalizada para o seu volume e estrutura.</p></div>
              <button onClick={() => scrollToLead(601)} className="shrink-0 rounded-xl border border-acex-teal px-5 py-3 text-sm font-black text-acex-teal hover:bg-acex-teal hover:text-acex-navy">Solicitar proposta personalizada</button>
            </div>
          </div>
        </section>

        <section id="simulacao" className="scroll-mt-20 bg-acex-cream py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-acex-teal">Simule agora</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-acex-navy sm:text-4xl">Descubra o plano ideal.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">Informe a quantidade de unidades ou moradores atendidos pela portaria.</p>
              <div className="mt-8 rounded-3xl bg-acex-navy p-6 text-white shadow-xl">
                <label htmlFor="unit-count" className="text-sm font-bold text-white/65">Quantidade de unidades</label>
                <div className="mt-3 flex items-center gap-3">
                  <input id="unit-count" type="number" min="1" max="5000" value={units} onChange={(event) => setUnits(Math.max(1, Math.min(5000, Number(event.target.value) || 1)))} className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 text-xl font-black text-white outline-none focus:border-acex-lime" />
                  <div className="rounded-xl bg-white/10 px-4 py-4 text-sm font-bold text-white/55">unidades</div>
                </div>
                <input type="range" min="1" max="800" value={Math.min(units, 800)} onChange={(event) => setUnits(Number(event.target.value))} className="mt-5 w-full accent-[#b8d83d]" aria-label="Selecionar quantidade de unidades" />
                <div className="mt-6 border-t border-white/10 pt-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-acex-lime">Plano recomendado</p><p className="mt-1 text-2xl font-black">{selectedPlan.name}</p><p className="mt-1 text-sm text-white/50">{selectedPlan.range}</p></div><div className="text-right">{selectedPlan.price ? <><p className="text-3xl font-black">R$ {selectedPlan.price}</p><p className="text-xs text-white/45">por mês</p></> : <p className="rounded-full bg-acex-lime px-3 py-2 text-sm font-black text-acex-navy">Sob consulta</p>}</div></div>
                </div>
              </div>
            </div>

            <form onSubmit={handleLead} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-acex sm:p-8">
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-acex-mint text-acex-teal"><Building2 className="h-5 w-5" /></div><div><h3 className="text-xl font-black text-acex-navy">Receber proposta</h3><p className="text-sm text-slate-500">Enviaremos os detalhes para o seu e-mail.</p></div></div>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-bold text-acex-ink">Seu nome</span><input name="name" required maxLength={100} className="acex-input" placeholder="Nome completo" /></label>
                <label><span className="mb-2 block text-sm font-bold text-acex-ink">Condomínio</span><input name="condominium" required maxLength={120} className="acex-input" placeholder="Nome do condomínio" /></label>
                <label><span className="mb-2 block text-sm font-bold text-acex-ink">E-mail</span><input name="email" required type="email" maxLength={160} className="acex-input" placeholder="voce@condominio.com.br" /></label>
                <label><span className="mb-2 block text-sm font-bold text-acex-ink">Telefone/WhatsApp</span><input name="phone" required maxLength={24} className="acex-input" placeholder="(27) 99999-9999" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-acex-ink">Algo que precisamos saber? <span className="font-normal text-slate-400">Opcional</span></span><textarea name="message" maxLength={1000} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-acex-teal focus:ring-4 focus:ring-acex-teal/10" placeholder="Conte um pouco sobre a operação da portaria." /></label>
                <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <div className="mt-6 rounded-2xl bg-acex-mint/70 p-4 text-sm text-acex-navy"><strong>{selectedPlan.name}</strong> para <strong>{units} unidades</strong>{selectedPlan.price ? <> · investimento estimado de <strong>R$ {selectedPlan.price}/mês</strong></> : <> · valor personalizado</>}.</div>
              {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              {sent && <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm font-semibold">Solicitação enviada. Nossa equipe entrará em contato com você.</p></div>}
              <button disabled={sending} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-acex-teal text-base font-black text-acex-navy shadow-lg shadow-acex-teal/15 hover:bg-[#d56529] disabled:cursor-not-allowed disabled:opacity-60">{sending && <Loader2 className="h-5 w-5 animate-spin" />}Enviar e receber proposta</button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">Ao enviar, você autoriza o contato da equipe ACEX sobre esta proposta.</p>
            </form>
          </div>
        </section>

        <section id="duvidas" className="bg-[#fbf8f4] py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <div className="text-center"><p className="text-sm font-black uppercase tracking-[0.16em] text-acex-teal">Dúvidas frequentes</p><h2 className="mt-4 text-3xl font-black text-acex-navy">Antes de começar</h2></div>
            <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {[
                ['Como é definido o plano?', 'O plano é calculado pela quantidade de unidades atendidas pelo condomínio. Acima de 600 unidades, a proposta é personalizada.'],
                ['Posso testar antes de contratar?', 'Sim. A proposta inclui um período de teste de 14 dias para conhecer a operação do sistema.'],
                ['Preciso instalar algum programa?', 'Não. O ACEX Portaria funciona pela web e pode ser acessado nos dispositivos usados pela equipe, conforme a configuração do condomínio.'],
                ['A equipe recebe ajuda na implantação?', 'Sim. A implantação inclui apoio para configurar a estrutura inicial e orientar a operação da portaria.'],
              ].map(([question, answer]) => (
                <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-acex-navy"><span>{question}</span><ChevronDown className="h-5 w-5 shrink-0 text-acex-teal transition group-open:rotate-180" /></summary><p className="max-w-2xl pt-4 leading-7 text-slate-500">{answer}</p></details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-acex-navy py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-center">
          <AcexLogo inverse />
          <div className="flex flex-wrap gap-6 text-sm font-semibold text-white/55"><a href="#solucao" className="hover:text-white">Solução</a><a href="#planos" className="hover:text-white">Planos</a><a href="#duvidas" className="hover:text-white">Dúvidas</a><Link to="/login" className="hover:text-white">Acessar sistema</Link></div>
          <div className="text-center md:text-right"><AcexCredit inverse /><p className="mt-2 text-sm text-white/40">© {new Date().getFullYear()} ACEX Portaria</p></div>
        </div>
      </footer>
    </div>
  );
}
