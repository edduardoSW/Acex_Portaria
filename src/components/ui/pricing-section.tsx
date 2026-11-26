import { Check, MailCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export type PricingPlan = {
  key: string;
  name: string;
  range: string;
  price: number | null;
  description: string;
  confirmationUsers: number | null;
  features: string[];
  featured?: boolean;
};

type PricingSectionProps = {
  plans: PricingPlan[];
  onSelect: (plan: PricingPlan) => void;
  onCustom: () => void;
};

export function PricingSection({ plans, onSelect, onCustom }: PricingSectionProps) {
  return (
    <section id="planos" className="pricing-section theme-section relative w-full overflow-hidden bg-black py-20 font-sans text-white selection:bg-white selection:text-black sm:py-28">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 flex flex-col items-center text-center sm:mb-16">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-acex-teal">Planos transparentes</p>
          <h2 className="max-w-3xl text-balance text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
            Um plano para cada porte. <span className="text-neutral-600">Sem taxas escondidas.</span>
          </h2>
          <p className="mt-5 max-w-xl text-balance text-base leading-7 text-neutral-400 sm:text-lg">
            Valores por quantidade de unidades residenciais, com implantação assistida e teste gratuito por 15 dias.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-acex-teal" />
            15 dias grátis para testar · sem compromisso
          </div>
        </div>

        <div className="pricing-email-banner mb-10 grid gap-5 rounded-xl border border-acex-teal/25 bg-acex-teal/[0.08] p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-acex-teal text-black"><MailCheck className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-medium text-white">Confirmação de retirada por e-mail</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-400">Cada condomínio define usuários autorizados para receber o código de confirmação. O limite incluído aumenta conforme o plano.</p>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={cn(
                'pricing-card theme-panel relative flex flex-col overflow-hidden rounded-xl border bg-[#050505] p-7 transition-all duration-300 sm:p-8',
                plan.featured ? 'pricing-card-featured border-acex-teal/60 shadow-2xl lg:-translate-y-3 lg:scale-[1.02]' : 'border-white/[0.08] hover:-translate-y-1 hover:border-white/[0.18]',
              )}
            >
              {plan.featured && <div className="pricing-highlight absolute inset-x-0 top-0 h-px bg-white" />}
              <div className="mb-6 flex min-h-20 items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-white">{plan.name}</h3>
                  <p className="mt-2 text-sm text-neutral-400">{plan.description}</p>
                </div>
                {plan.featured && (
                  <span className="pricing-badge shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
                    Recomendado
                  </span>
                )}
              </div>

              <div className={cn('pricing-email-limit mb-6 rounded-lg border p-4', plan.featured ? 'border-acex-teal/25 bg-acex-teal/[0.08]' : 'border-white/[0.08] bg-white/[0.025]')}>
                <div className="flex items-start gap-3">
                  <MailCheck className={cn('mt-0.5 h-5 w-5 shrink-0', plan.featured ? 'text-acex-teal' : 'text-neutral-500')} />
                  <div>
                    <p className="text-sm font-medium text-white">{plan.confirmationUsers} {plan.confirmationUsers === 1 ? 'usuário autorizado' : 'usuários autorizados'}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">{plan.confirmationUsers === 1 ? 'Recebe' : 'Recebem'} por e-mail o código para confirmar a retirada.</p>
                  </div>
                </div>
              </div>

              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-500">{plan.range}</p>
              <div className="mb-7 flex items-baseline gap-1">
                <span className="text-lg font-medium text-neutral-300">R$</span>
                <span className="text-5xl font-medium tracking-[-0.06em]">{plan.price}</span>
                <span className="text-sm font-medium text-neutral-500">/ mês</span>
              </div>

              <button
                type="button"
                onClick={() => onSelect(plan)}
                className={cn(
                  'mb-8 flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition-all active:scale-[0.98]',
                  plan.featured
                    ? 'pricing-primary bg-white text-black hover:bg-neutral-200'
                    : 'border border-white/[0.12] bg-transparent text-white hover:bg-white/[0.05]',
                )}
              >
                Testar 15 dias com {plan.name}
              </button>

              <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-widest text-neutral-500">Teste grátis por 15 dias</p>

              <div className="pricing-divider mb-6 h-px w-full bg-white/[0.08]" />
              <ul className="flex flex-col gap-4 text-sm text-neutral-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', plan.featured ? 'text-white' : 'text-neutral-500')} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="theme-panel mt-8 flex flex-col items-center justify-between gap-5 rounded-xl border border-white/[0.08] bg-[#050505] p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-medium text-white">Mais de 600 unidades residenciais?</p>
            <p className="mt-1 text-sm text-neutral-500">Criamos uma proposta personalizada para o seu volume e estrutura.</p>
          </div>
          <button type="button" onClick={onCustom} className="h-11 shrink-0 rounded-md border border-white/[0.12] px-5 text-sm font-medium text-white transition hover:bg-white hover:text-black active:scale-[0.98]">
            Solicitar proposta personalizada
          </button>
        </div>
      </div>
    </section>
  );
}
