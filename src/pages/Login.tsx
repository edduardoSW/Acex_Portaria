import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CheckCircle2, Eye, EyeOff, KeyRound, PackageCheck, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  getPasswordFieldErrors,
} from '../utils/passwordValidation';
import { AcexLogo } from '../components/AcexLogo';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.pathname === '/redefinir-senha');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const googleLoginEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });
  const emailValue = watch('email', '');
  const passwordValue = watch('password', '');
  const isLoginDisabled =
    loading || !emailValue || !passwordValue || !isValid;

  useEffect(() => {
    const isGoogleCallback = new URLSearchParams(window.location.search).get('oauth') === 'google';
    let googleHandled = false;

    const completeGoogleLogin = async (userId: string) => {
      if (googleHandled) return;
      googleHandled = true;
      setGoogleLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError('Sua conta Google ainda não está vinculada a um usuário do ACEX Portaria. Use o mesmo e-mail cadastrado ou fale com o administrador.');
        setGoogleLoading(false);
        return;
      }

      if (profile.status === 'inactive') {
        await supabase.auth.signOut();
        setError('Este usuário está desativado. Fale com o administrador do condomínio.');
        setGoogleLoading(false);
        return;
      }

      if (profile.role === 'general_manager') navigate('/geral', { replace: true });
      else if (profile.role === 'admin') navigate('/admin', { replace: true });
      else navigate('/porteiro', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (isGoogleCallback && session) void completeGoogleLogin(session.user.id);
    });

    const checkGoogleCallback = async () => {
      if (!isGoogleCallback) return;

      setGoogleLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setGoogleLoading(false);
        return;
      }
      await completeGoogleLogin(session.user.id);
    };

    void checkGoogleCallback();
    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');

    try {
      const { 
        data: authData, 
        error: authError 
      } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Usuário não retornado pelo Supabase.');

      console.log('Auth:', authData);
      console.log('Usuário:', authData.user);

      const { 
        data: profile, 
        error: profileError 
      } = await supabase
        .from('profiles')
        .select('id, name, email, role, condominium_id, status')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Perfil não encontrado.');
      if (profile.status === 'inactive') throw new Error('Usuário desativado.');

      console.log('Perfil:', profile);
      console.log('Role:', profile?.role);

      if (profile.role === 'general_manager') {
        navigate('/geral', { replace: true });
      } else if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (profile.role === 'doorman') {
        navigate('/porteiro', { replace: true });
      } else {
        throw new Error('Perfil sem função válida.');
      }
    } catch (error) {
      console.error('Erro completo no login:', error);

      setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setError('');

    try {
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        { redirectTo },
      );

      if (error) throw error;

      setForgotSuccess(true);
    } catch (error) {
      console.error('Erro na solicitação de redefinição:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Erro ao criar solicitação.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login?oauth=google`,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      setError(error.message || 'Não foi possível entrar com o Google.');
      setGoogleLoading(false);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const validation = getPasswordFieldErrors(newPassword, confirmPassword);
    if (validation.hasErrors) {
      setError(validation.password || validation.confirmation || 'Confira as senhas informadas.');
      return;
    }

    setRecoveryLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setRecoveryLoading(false);

    if (error) {
      setError(error.message || 'Não foi possível atualizar a senha.');
      return;
    }

    setRecoverySuccess(true);
  };

  const finishPasswordRecovery = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-shell min-h-screen lg:grid lg:grid-cols-[38%_62%]">
      <section className="auth-brand-panel relative hidden overflow-hidden bg-black p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(232,117,50,0.16),transparent_34%)]" />
        <AcexLogo inverse />
        <div className="relative max-w-md">
          <span className="inline-flex rounded-full border border-acex-teal/30 bg-acex-teal/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-acex-teal">Gestão inteligente</span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight xl:text-5xl">A portaria do seu condomínio, mais simples.</h1>
          <p className="mt-5 text-base leading-7 text-white/60">Controle de encomendas, moradores e equipe com uma operação clara, segura e conectada.</p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {[{ icon: PackageCheck, label: 'Encomendas' }, { icon: Building2, label: 'Condomínios' }, { icon: ShieldCheck, label: 'Segurança' }].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Icon className="h-5 w-5 text-acex-teal" />
              <p className="mt-3 text-xs font-bold text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-form-panel flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="auth-card w-full max-w-md space-y-8 rounded-xl border p-6 sm:p-8">
        <div className="text-center">
          <div className="flex justify-center lg:hidden"><AcexLogo /></div>
          <div className="mb-5 flex justify-center text-acex-teal"><KeyRound className="h-6 w-6" /></div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-acex-teal">ACEX Portaria</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-acex-ink">{recoveryMode ? 'Defina sua nova senha' : forgotPassword ? 'Recupere seu acesso' : 'Acesse sua conta'}</h2>
          <p className="mt-2 text-slate-500">
            {recoveryMode ? 'Escolha uma senha segura para continuar.' : forgotPassword ? 'Enviaremos um link seguro para o seu e-mail.' : 'Entre com e-mail e senha ou use sua conta Google.'}
          </p>
        </div>
        
        {recoveryMode ? (
          <form className="mt-8 space-y-5" onSubmit={handlePasswordUpdate}>
            {error && <div className="rounded-lg bg-red-50 p-4 text-center text-red-700">{error}</div>}
            {recoverySuccess ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-3 font-semibold text-acex-ink">Senha atualizada com sucesso.</p>
                <button type="button" onClick={finishPasswordRecovery} className="mt-5 h-11 w-full rounded-md bg-acex-teal font-semibold text-acex-navy hover:bg-[#d56529]">Ir para o login</button>
              </div>
            ) : (
              <>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={PASSWORD_MIN_LENGTH} required placeholder="Nova senha" className="acex-input h-14 text-base" />
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={PASSWORD_MIN_LENGTH} required placeholder="Confirme a nova senha" className="acex-input h-14 text-base" />
                <p className="text-sm text-slate-500">Use pelo menos {PASSWORD_MIN_LENGTH} caracteres.</p>
                <button type="submit" disabled={recoveryLoading} className="flex h-14 w-full items-center justify-center rounded-md bg-acex-teal text-base font-semibold text-acex-navy hover:bg-[#d56529] disabled:opacity-50">{recoveryLoading ? 'Atualizando...' : 'Salvar nova senha'}</button>
              </>
            )}
          </form>
        ) : forgotPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
                {error}
              </div>
            )}
            
            {forgotSuccess ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5 text-center text-emerald-700">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-3 font-semibold">Confira seu e-mail.</p>
                <p className="mt-1 text-sm">Se existir uma conta cadastrada, você receberá um link seguro para criar uma nova senha.</p>
                <button
                  type="button"
                  onClick={() => setForgotPassword(false)}
                  className="mt-3 font-bold text-acex-teal hover:underline"
                >
                  Voltar para login
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="forgotEmail" className="sr-only">
                      E-mail
                    </label>
                    <input
                      id="forgotEmail"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="E-mail"
                      className="acex-input h-14 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="group relative flex h-14 w-full justify-center rounded-md bg-acex-teal px-4 py-4 text-base font-semibold text-acex-navy transition-colors hover:bg-[#d56529] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar solicitação'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="w-full px-4 py-4 font-semibold text-acex-teal hover:underline"
                  >
                    Voltar para login
                  </button>
                </div>
              </>
            )}
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
                {error}
              </div>
            )}

            {googleLoginEnabled && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white text-base font-semibold text-acex-ink transition hover:border-acex-teal/50 hover:bg-acex-mint/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path fill="#4285F4" d="M21.35 11.1h-9.18v2.98h5.28c-.23 1.56-1.79 4.58-5.28 4.58-3.18 0-5.78-2.63-5.78-5.86s2.6-5.86 5.78-5.86c1.81 0 3.02.77 3.71 1.45l2.53-2.48C16.79 4.37 14.68 3.4 12.17 3.4c-5.03 0-9.1 4.22-9.1 9.4s4.07 9.4 9.1 9.4c5.25 0 8.72-3.8 8.72-9.15 0-.62-.07-1.1-.15-1.55z" /></svg>
                  {googleLoading ? 'Conectando...' : 'Continuar com Google'}
                </button>
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>ou use seu e-mail</span><span className="h-px flex-1 bg-slate-200" /></div>
              </>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  E-mail
                </label>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="E-mail"
                  className="acex-input h-14 text-base"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>
              
              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Senha
                </label>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Senha"
                  className="acex-input h-14 pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-acex-teal"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={isLoginDisabled}
                className="group relative flex h-14 w-full justify-center rounded-md bg-acex-teal px-4 py-4 text-base font-semibold text-acex-navy shadow-lg shadow-acex-teal/15 transition-colors hover:bg-[#d56529] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="w-full px-4 py-3 font-semibold text-acex-teal hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        )}
      </div>
      </section>
    </div>
  );
}
