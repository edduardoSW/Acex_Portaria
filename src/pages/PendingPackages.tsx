import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PackageWithResident } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function PendingPackages() {
  const [packages, setPackages] = useState<PackageWithResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<PackageWithResident | null>(null);
  const [deliveredTo, setDeliveredTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    async function loadPackages() {
      if (!profile) return;

      const { data } = await supabase
        .from('packages')
        .select(`
          *,
          resident:residents(*)
        `)
        .eq('condominium_id', profile.condominium_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (data) setPackages(data as unknown as PackageWithResident[]);
      
      setLoading(false);
    }

    loadPackages();

    if (!profile) return;

    // Set up real-time subscription
    const channel = supabase
      .channel('public:packages-pending')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packages',
          filter: `condominium_id=eq.${profile.condominium_id}`,
        },
        () => {
          loadPackages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleDeliver = async () => {
    if (!selectedPackage || !profile || !deliveredTo.trim()) return;

    setSubmitting(true);

    try {
      await supabase
        .from('packages')
        .update({
          status: 'delivered',
          delivered_by: profile.id,
          delivered_to: deliveredTo.trim(),
          delivered_at: new Date().toISOString(),
        })
        .eq('id', selectedPackage.id);

      // Refresh the list
      setPackages(packages.filter(p => p.id !== selectedPackage.id));
      setSelectedPackage(null);
      setDeliveredTo('');
    } catch (error) {
      console.error('Erro ao entregar encomenda:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendWhatsApp = async (_pkg: PackageWithResident) => {
    // In a real app, you would call the WhatsApp service again here
    // For now, we'll just show a message
    alert('Reenvio de WhatsApp (implementar na Evolution API)');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Encomendas Pendentes</h1>

          {selectedPackage ? (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="font-semibold text-gray-900 text-xl">{selectedPackage.resident.name}</p>
                <p className="text-gray-600">
                  Bloco {selectedPackage.resident.block} - Apto {selectedPackage.resident.apartment}
                </p>
                <p className="text-gray-500 mt-2">
                  {new Date(selectedPackage.created_at).toLocaleDateString('pt-BR')} às {new Date(selectedPackage.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {!selectedPackage.whatsapp_sent && (
                  <div className="mt-3 flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">WhatsApp não enviado</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Quem retirou?</label>
                <input
                  type="text"
                  value={deliveredTo}
                  onChange={(e) => setDeliveredTo(e.target.value)}
                  placeholder="Nome da pessoa que retirou"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="flex-1 py-4 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeliver}
                  disabled={submitting || !deliveredTo.trim()}
                  className="flex-1 py-4 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Confirmando...
                    </span>
                  ) : (
                    'Confirmar Retirada'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {packages.length === 0 ? (
                <div className="text-center py-12">
                  <Check className="w-16 h-16 text-green-200 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nenhuma encomenda pendente</p>
                </div>
              ) : (
                packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{pkg.resident.name}</p>
                        <p className="text-gray-600">
                          Bloco {pkg.resident.block} - Apto {pkg.resident.apartment}
                        </p>
                        <p className="text-gray-500 mt-1">
                          {new Date(pkg.created_at).toLocaleDateString('pt-BR')} às {new Date(pkg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {!pkg.whatsapp_sent && (
                          <button
                            onClick={() => handleResendWhatsApp(pkg)}
                            className="mt-2 text-sm text-yellow-600 hover:text-yellow-700 flex items-center gap-1"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Reenviar WhatsApp
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedPackage(pkg)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                      >
                        Entregar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
