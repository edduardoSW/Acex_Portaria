import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from '../utils/passwordValidation';

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

      if (profile.role === 'admin') {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Acex Portaria</h2>
          <p className="mt-2 text-gray-600">
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
                  className="mt-3 text-blue-600 hover:underline"
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
                      className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar solicitação'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="w-full py-4 px-4 text-blue-600 hover:text-blue-700 font-medium"
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
                  className="appearance-none relative block w-full px-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
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
                  className="appearance-none relative block w-full px-4 py-4 pr-12 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="w-full py-3 px-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
