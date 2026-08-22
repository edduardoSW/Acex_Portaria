import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Loader2, Mail, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { pickupCodeService } from '../lib/pickup-code-service';
import { PackageWithResident } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Feedback = { type: 'success' | 'error' | 'warning'; message: string };
type PickupEvent = { id: string; event_type: string; created_at: string };

const eventLabels: Record<string, string> = {
  email_sent: 'Código enviado por e-mail', email_failed: 'Falha no envio do e-mail',
  code_resent: 'Código reenviado', code_regenerated: 'Novo código gerado',
  attempt_failed: 'Tentativa incorreta', attempt_blocked: 'Tentativas bloqueadas',
  code_expired: 'Código expirado', confirmed: 'Retirada confirmada',
};

export function PendingPackages() {
  const [packages, setPackages] = useState<PackageWithResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<PackageWithResident | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [events, setEvents] = useState<PickupEvent[]>([]);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const loadPackages = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('packages').select('*, resident:residents(*)')
      .eq('condominium_id', profile.condominium_id).eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setPackages(data as unknown as PackageWithResident[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadPackages();
    if (!profile) return;
    const channel = supabase.channel('public:packages-pending').on('postgres_changes', {
      event: '*', schema: 'public', table: 'packages', filter: `condominium_id=eq.${profile.condominium_id}`,
    }, loadPackages).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, loadPackages]);

  async function openConfirmation(pkg: PackageWithResident) {
    setSelectedPackage(pkg); setCode(''); setFeedback(null);
    const { data } = await supabase.from('package_pickup_events').select('id,event_type,created_at')
      .eq('package_id', pkg.id).order('created_at', { ascending: false }).limit(20);
    setEvents((data ?? []) as PickupEvent[]);
  }

  async function confirmPickup() {
    if (!selectedPackage || !/^\d{6}$/.test(code)) return;
    setSubmitting(true); setFeedback(null);
    try {
      const response = await pickupCodeService.confirm(selectedPackage.id, code);
      if (response.success) {
        setFeedback({ type: 'success', message: 'Código confirmado. Entrega autorizada' });
        setPackages((current) => current.filter((pkg) => pkg.id !== selectedPackage.id));
        setTimeout(() => { setSelectedPackage(null); setFeedback(null); }, 1800);
      } else {
        setFeedback({ type: response.reason === 'locked' ? 'warning' : 'error', message: response.message });
        setCode('');
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível validar o código' });
    } finally { setSubmitting(false); }
  }

  async function rotateCode(pkg: PackageWithResident, action: 'resend' | 'regenerate') {
    if (action === 'regenerate' && !confirm('Gerar um novo código? O código anterior será invalidado.')) return;
    setActionId(pkg.id); setFeedback(null);
    try {
      const response = action === 'resend' ? await pickupCodeService.resend(pkg.id) : await pickupCodeService.regenerate(pkg.id);
      setFeedback({ type: response.emailSent ? 'success' : 'warning', message: response.emailSent ? 'Novo código enviado por e-mail com sucesso.' : 'Código renovado, mas houve falha no envio do e-mail.' });
      await loadPackages();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível processar a solicitação' });
    } finally { setActionId(null); }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"><ArrowLeft className="w-5 h-5" />Voltar</button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Encomendas pendentes</h1>
          {feedback && !selectedPackage && <FeedbackBox feedback={feedback} />}
          {!packages.length ? <div className="text-center py-12"><Check className="w-16 h-16 text-green-200 mx-auto mb-4" /><p className="text-gray-500 text-lg">Nenhuma encomenda pendente</p></div> : (
            <div className="space-y-4">{packages.map((pkg) => (
              <div key={pkg.id} className="p-5 rounded-xl border border-gray-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                  <div><p className="font-semibold text-gray-900 text-lg">{pkg.resident.name}</p><p className="text-gray-600">Bloco {pkg.resident.block} - Apto {pkg.resident.apartment}</p><p className="text-gray-500 text-sm mt-1">{new Date(pkg.created_at).toLocaleString('pt-BR')}</p><p className={`mt-2 text-sm flex items-center gap-1 ${pkg.email_delivery_status === 'sent' ? 'text-green-700' : 'text-yellow-700'}`}><Mail className="w-4 h-4" />{pkg.email_delivery_status === 'sent' ? 'E-mail enviado' : 'Envio de e-mail pendente ou com falha'}</p></div>
                  <button onClick={() => openConfirmation(pkg)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">Confirmar retirada</button>
                </div>
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-3">
                  <button disabled={actionId === pkg.id} onClick={() => rotateCode(pkg, 'resend')} className="text-sm text-blue-700 hover:text-blue-900 flex items-center gap-1 disabled:opacity-50"><Mail className="w-4 h-4" />Reenviar código por e-mail</button>
                  <button disabled={actionId === pkg.id} onClick={() => rotateCode(pkg, 'regenerate')} className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1 disabled:opacity-50"><RefreshCw className="w-4 h-4" />Gerar novo código</button>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {selectedPackage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Confirmar retirada</h2><p className="text-gray-600">{selectedPackage.resident.name}</p></div><button onClick={() => setSelectedPackage(null)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button></div>
          {feedback && <div className="mt-5"><FeedbackBox feedback={feedback} /></div>}
          <label className="block mt-6 mb-2 font-medium text-gray-700">Código de 6 dígitos</label>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus className="w-full rounded-xl border border-gray-300 px-4 py-4 text-center text-3xl tracking-[0.35em] focus:ring-2 focus:ring-blue-600" placeholder="000000" />
          <button onClick={confirmPickup} disabled={submitting || code.length !== 6} className="mt-4 w-full rounded-xl bg-green-600 px-4 py-4 font-medium text-white disabled:opacity-50">{submitting ? 'Validando...' : 'Validar código e entregar'}</button>
          <div className="mt-6 border-t pt-5"><h3 className="font-semibold text-gray-900 mb-3">Histórico de segurança</h3>{events.length ? <ul className="space-y-2">{events.map((event) => <li key={event.id} className="flex justify-between gap-3 text-sm"><span>{eventLabels[event.event_type] ?? event.event_type}</span><span className="text-gray-500">{new Date(event.created_at).toLocaleString('pt-BR')}</span></li>)}</ul> : <p className="text-sm text-gray-500">Nenhum evento registrado.</p>}</div>
        </div>
      </div>}
    </div>
  );
}

function FeedbackBox({ feedback }: { feedback: Feedback }) {
  const styles = feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : feedback.type === 'warning' ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-red-200 bg-red-50 text-red-800';
  return <div className={`rounded-xl border p-4 flex gap-2 ${styles}`}>{feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}<p>{feedback.message}</p></div>;
}
