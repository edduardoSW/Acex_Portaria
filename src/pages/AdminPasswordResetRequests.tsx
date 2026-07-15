import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordResetRequestWithProfile, PasswordResetRequest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getPasswordFieldErrors } from '../utils/passwordValidation';

type ResetPasswordFormState = {
  password: string;
  confirmation: string;
  showPassword: boolean;
  showConfirmation: boolean;
  submitError: string | null;
};

const createEmptyResetPasswordForm = (): ResetPasswordFormState => ({
  password: '',
  confirmation: '',
  showPassword: false,
  showConfirmation: false,
  submitError: null,
});

export function AdminPasswordResetRequests() {
  const [requests, setRequests] = useState<PasswordResetRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [resetForms, setResetForms] = useState<Record<string, ResetPasswordFormState>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const getResetForm = (requestId: string): ResetPasswordFormState =>
    resetForms[requestId] ?? createEmptyResetPasswordForm();

  const updateResetForm = (
    requestId: string,
    updater: (current: ResetPasswordFormState) => ResetPasswordFormState
  ) => {
    setResetForms((current) => {
      const form = current[requestId] ?? createEmptyResetPasswordForm();
      return {
        ...current,
        [requestId]: updater(form),
      };
    });
  };

  async function loadRequests() {
    if (!profile) return;

    setLoading(true);
    setPageError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("password_reset_requests")
        .select(`
          id, 
          profile_id, 
          email, 
          condominium_id, 
          status, 
          requested_at, 
          resolved_at, 
          resolved_by, 
          requester:profiles!password_reset_requests_profile_id_fkey ( 
            id, 
            name, 
            email, 
            role, 
            status 
          ), 
          resolver:profiles!password_reset_requests_resolved_by_fkey ( 
            id, 
            name, 
            email 
          ) 
        `)
        .eq("condominium_id", profile.condominium_id)
        .order("requested_at", { ascending: false });

      if (loadError) {
        console.error("Erro completo:", {
          code: loadError.code,
          message: loadError.message,
          details: loadError.details,
          hint: loadError.hint,
        });
        setPageError(loadError.message);
        return;
      }

      setRequests((data ?? []).map((item: any) => ({
        ...item,
        requester: Array.isArray(item.requester) ? item.requester[0] || null : item.requester,
        resolver: Array.isArray(item.resolver) ? item.resolver[0] || null : item.resolver,
      })) as PasswordResetRequestWithProfile[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();

    if (!profile) return;

    const channel = supabase
      .channel('public:password-reset-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'password_reset_requests',
          filter: `condominium_id=eq.${profile.condominium_id}`,
        },
        () => loadRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  async function handleResolve(request: PasswordResetRequestWithProfile) {
    const form = getResetForm(request.id);
    const validation = getPasswordFieldErrors(
      form.password,
      form.confirmation,
      {
        requirePassword: true,
        requireConfirmation: true,
      }
    );

    if (validation.hasErrors) {
      updateResetForm(request.id, (current) => ({
        ...current,
        submitError: null,
      }));
      return;
    }

    setPageError(null);
    setProcessingId(request.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-password-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            requestId: request.id,
            newPassword: form.password,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao resolver solicitação');
      }

      setResetForms((current) => ({
        ...current,
        [request.id]: createEmptyResetPasswordForm(),
      }));
      await loadRequests();
    } catch (err) {
      console.error('Erro completo ao resolver solicitação:', err);
      updateResetForm(request.id, (current) => ({
        ...current,
        submitError:
          err instanceof Error ? err.message : 'Erro ao resolver solicitação',
      }));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(request: PasswordResetRequest) {
    if (!profile) return;
    setPageError(null);
    setProcessingId(request.id);

    try {
      const { error: updateError } = await supabase
        .from('password_reset_requests')
        .update({ 
          status: 'cancelled', 
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id
        })
        .eq('id', request.id);

      if (updateError) {
        throw updateError;
      }

      // Create activity log for cancellation
      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          action: 'password_reset_cancelled',
          profile_id: profile.id,
          condominium_id: profile.condominium_id,
          package_id: null,
        });
      
      if (logError) {
        console.error('Erro completo ao registrar cancelamento:', {
          code: logError.code,
          message: logError.message,
          details: logError.details,
          hint: logError.hint,
        });
      }

      await loadRequests();
    } catch (err) {
      console.error('Erro completo ao cancelar solicitação:', err);
      setPageError(err instanceof Error ? err.message : 'Erro ao cancelar solicitação');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Solicitações de Redefinição de Senha</h1>
          <div className="w-24"></div>
        </div>

        {pageError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{pageError}</p>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-500 text-lg">Nenhuma solicitação de redefinição de senha.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const form = getResetForm(request.id);
              const passwordValidation = getPasswordFieldErrors(
                form.password,
                form.confirmation,
                {
                  requirePassword: true,
                  requireConfirmation: true,
                }
              );
              const shouldShowPasswordErrors =
                form.password.length > 0 || form.confirmation.length > 0;
              const isResolveDisabled =
                processingId === request.id ||
                !form.password ||
                !form.confirmation ||
                passwordValidation.hasErrors;

              return (
                <div
                  key={request.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {request.requester?.name ?? 'Usuário não encontrado'}
                      </h3>
                      <p className="text-gray-600">
                        {request.requester?.email ?? request.email}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(request.requested_at).toLocaleString('pt-BR')}
                      </p>
                      {request.status !== 'pending' && request.resolver && (
                        <p className="text-sm text-gray-500 mt-1">
                          {request.status === 'resolved' ? 'Resolvido' : 'Cancelado'} por: {request.resolver.name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : request.status === 'resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {request.status === 'pending'
                        ? 'Pendente'
                        : request.status === 'resolved'
                        ? 'Resolvido'
                        : 'Cancelado'}
                    </span>
                  </div>

                  {request.status === 'pending' && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="relative">
                          <input
                            type={form.showPassword ? 'text' : 'password'}
                            placeholder="Nova senha"
                            value={form.password}
                            onChange={(e) =>
                              updateResetForm(request.id, (current) => ({
                                ...current,
                                password: e.target.value,
                                submitError: null,
                              }))
                            }
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateResetForm(request.id, (current) => ({
                                ...current,
                                showPassword: !current.showPassword,
                              }))
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            aria-label={form.showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {form.showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {shouldShowPasswordErrors && passwordValidation.password && (
                          <p className="mt-1 text-sm text-red-500">
                            {passwordValidation.password}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="relative">
                          <input
                            type={form.showConfirmation ? 'text' : 'password'}
                            placeholder="Confirmar senha"
                            value={form.confirmation}
                            onChange={(e) =>
                              updateResetForm(request.id, (current) => ({
                                ...current,
                                confirmation: e.target.value,
                                submitError: null,
                              }))
                            }
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateResetForm(request.id, (current) => ({
                                ...current,
                                showConfirmation: !current.showConfirmation,
                              }))
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            aria-label={form.showConfirmation ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {form.showConfirmation ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {shouldShowPasswordErrors && passwordValidation.confirmation && (
                          <p className="mt-1 text-sm text-red-500">
                            {passwordValidation.confirmation}
                          </p>
                        )}
                      </div>
                      {form.submitError && (
                        <p className="text-sm text-red-500">{form.submitError}</p>
                      )}
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleResolve(request)}
                          disabled={isResolveDisabled}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {processingId === request.id ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            'Redefinir Senha'
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel(request)}
                          disabled={processingId === request.id}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {request.status !== 'pending' && request.resolved_at && (
                    <p className="text-sm text-gray-500 mt-4">
                      {request.status === 'resolved' ? 'Resolvido' : 'Cancelado'} em{' '}
                      {new Date(request.resolved_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
