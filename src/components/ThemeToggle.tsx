import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

type ThemeToggleProps = {
  theme: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const nextTheme = theme === 'dark' ? 'claro' : 'escuro';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`fixed bottom-4 right-4 z-[100] flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold shadow-2xl backdrop-blur-xl transition active:scale-95 ${
        theme === 'dark'
          ? 'border-white/15 bg-[#0a0a0a]/95 text-white hover:border-white/30'
          : 'border-black/10 bg-white/95 text-neutral-900 hover:border-black/25'
      }`}
      aria-label={`Ativar modo ${nextTheme}`}
      title={`Ativar modo ${nextTheme}`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">Modo {nextTheme}</span>
    </button>
  );
}
