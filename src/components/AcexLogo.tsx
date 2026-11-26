type AcexLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function AcexLogo({ compact = false, inverse = false }: AcexLogoProps) {
  return (
    <div className="leading-none" aria-label="ACEX Portaria by ACEX Partners">
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-black tracking-[0.16em] ${inverse ? 'text-white' : 'text-acex-navy'}`}>ACEX</span>
        {!compact && <span className={`text-sm font-black tracking-[0.2em] ${inverse ? 'text-acex-lime' : 'text-acex-teal'}`}>PORTARIA</span>}
      </div>
      {!compact && <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${inverse ? 'text-white/50' : 'text-slate-400'}`}>by ACEX Partners</div>}
    </div>
  );
}

export function AcexCredit({ inverse = false }: { inverse?: boolean }) {
  return (
    <a
      href="https://www.acexpartners.com.br/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-xs font-bold transition ${inverse ? 'text-white/45 hover:text-acex-lime' : 'text-slate-400 hover:text-acex-teal'}`}
    >
      <span>by ACEX Partners</span>
      <span className="font-medium">acexpartners.com.br</span>
    </a>
  );
}
