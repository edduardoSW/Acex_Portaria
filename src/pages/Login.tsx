import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff, PackageCheck, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
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
      const { data, error } = await supabase.functions.invoke(
        'request-password-reset',
        {
          body: {
            email: forgotEmail.trim().toLowerCase(),
          },
        }
      );

      if (error) {
        let errMsg = error.message || 'Erro ao solicitar redefinição de senha';
        const context = (error as { context?: Response | { error?: string; message?: string } }).context;

        if (context instanceof Response) {
          const responseBody = await context.json().catch(() => null);
          errMsg = responseBody?.error || responseBody?.message || errMsg;
        } else if (context && typeof context === 'object') {
          errMsg = context.error || context.message || errMsg;
        }

        throw new Error(errMsg);
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error));
      }

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

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[35%_65%]">
      <section className="relative hidden overflow-hidden bg-acex-navy p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -left-28 top-1/3 h-80 w-80 rounded-full border-[56px] border-white/[0.035]" />
        <AcexLogo inverse />
        <div className="relative max-w-md">
          <span className="inline-flex rounded-full bg-acex-lime px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-acex-navy">Gestão inteligente</span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight xl:text-5xl">A portaria do seu condomínio, mais simples.</h1>
          <p className="mt-5 text-base leading-7 text-white/60">Controle de encomendas, moradores e equipe com uma operação clara, segura e conectada.</p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {[{ icon: PackageCheck, label: 'Encomendas' }, { icon: Building2, label: 'Condomínios' }, { icon: ShieldCheck, label: 'Segurança' }].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <Icon className="h-5 w-5 text-acex-lime" />
              <p className="mt-3 text-xs font-bold text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center lg:hidden"><AcexLogo /></div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-acex-teal">Bem-vindo de volta</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-acex-ink">Acesse sua conta</h2>
          <p className="mt-2 text-slate-500">
            {forgotPassword ? 'Solicitar redefinição de senha' : 'Entre com sua conta'}
          </p>
        </div>
        
        {forgotPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
                {error}
              </div>
            )}
            
            {forgotSuccess ? (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center">
                <p>Solicitação enviada com sucesso! Por favor, contate o administrador para redefinir sua senha.</p>
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
                      type="email"
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
                    className="group relative flex h-14 w-full justify-center rounded-xl bg-acex-teal px-4 py-4 text-base font-bold text-white transition-colors hover:bg-[#0b655e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar solicitação'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="w-full px-4 py-4 font-bold text-acex-teal hover:text-acex-navy"
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
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  E-mail
                </label>
                <input
                  {...register('email')}
                  type="email"
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
                  type={showPassword ? 'text' : 'password'}
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
                className="group relative flex h-14 w-full justify-center rounded-xl bg-acex-teal px-4 py-4 text-base font-bold text-white shadow-lg shadow-acex-teal/15 transition-colors hover:bg-[#0b655e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="w-full px-4 py-3 font-bold text-acex-teal hover:text-acex-navy"
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
