type AcexLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function AcexLogo({ compact = false, inverse = false }: AcexLogoProps) {
  return (
    <div className="flex items-center gap-3" aria-label="ACEX Portaria">
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl font-black tracking-tighter ${
          inverse ? 'bg-white text-acex-navy' : 'bg-acex-navy text-white'
        }`}
      >
        AX
      </div>
      {!compact && (
        <div className="leading-none">
          <div className={`text-xl font-black tracking-[0.16em] ${inverse ? 'text-white' : 'text-acex-navy'}`}>
            ACEX
          </div>
          <div className={`mt-1 text-[10px] font-bold uppercase tracking-[0.24em] ${inverse ? 'text-white/55' : 'text-slate-400'}`}>
            Portaria · by ACEX
          </div>
        </div>
      )}
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
