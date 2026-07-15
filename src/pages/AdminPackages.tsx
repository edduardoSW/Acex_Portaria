import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Package, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AdminPackage as AdminPackageType } from '../types';
import { useAuth } from '../contexts/AuthContext';

type PackageFilter = 'all' | 'today' | 'pending' | 'delivered' | 'delivered-today';

type AdminPackage = AdminPackageType;

const FILTER_OPTIONS: Array<{ value: PackageFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'today', label: 'Hoje' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'delivered-today', label: 'Entregues hoje' },
];

function getDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getNotificationLabel(status: AdminPackage['notification_status'], whatsappSent: boolean) {
  if (status === 'opened') return 'WhatsApp aberto';
  if (status === 'sent') return 'Notificação enviada';
  if (status === 'failed') return 'Falha no envio';
  if (whatsappSent) return 'WhatsApp enviado';
  return 'Pendente';
}

function getValidFilter(value: string | null): PackageFilter {
  if (
    value === 'today' ||
    value === 'pending' ||
    value === 'delivered' ||
    value === 'delivered-today'
  ) {
    return value;
  }

  return 'all';
}

export function AdminPackages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { profile } = useAuth();

  const filter = getValidFilter(searchParams.get('filter'));

  useEffect(() => {
    async function loadPackages() {
      if (!profile) return;

      setLoading(true);
      setError(null);

      try {
        const { startIso, endIso } = getDayBounds();

        let query = supabase
          .from('packages')
          .select(`
            id,
            status,
            created_at,
            delivered_at,
            delivered_to,
            notification_status,
            whatsapp_sent,
            condominium_id,
            resident:residents!packages_resident_id_fkey(
              id,
              name,
              block,
              apartment,
              whatsapp
            ),
            doorman:profiles!packages_registered_by_fkey(
              id,
              name,
              email
            ),
            delivered_by_profile:profiles!packages_delivered_by_fkey(
              id,
              name,
              email
            )
          `)
          .eq('condominium_id', profile.condominium_id)
          .order('created_at', { ascending: false });

        if (filter === 'today') {
          query = query.gte('created_at', startIso).lt('created_at', endIso);
        }

        if (filter === 'pending') {
          query = query.eq('status', 'pending');
        }

        if (filter === 'delivered') {
          query = query.eq('status', 'delivered');
        }

        if (filter === 'delivered-today') {
          query = query
            .eq('status', 'delivered')
            .gte('delivered_at', startIso)
            .lt('delivered_at', endIso);
        }

        const { data, error: packagesError } = await query;

        if (packagesError) {
          console.error('Erro completo ao carregar encomendas administrativas:', {
            code: packagesError.code,
            message: packagesError.message,
            details: packagesError.details,
            hint: packagesError.hint,
          });
          setError(packagesError.message);
          return;
        }

        setPackages((data ?? []).map((item: any) => ({
          ...item,
          resident: Array.isArray(item.resident) ? item.resident[0] || null : item.resident,
          doorman: Array.isArray(item.doorman) ? item.doorman[0] || null : item.doorman,
          delivered_by_profile: Array.isArray(item.delivered_by_profile) ? item.delivered_by_profile[0] || null : item.delivered_by_profile,
        })) as AdminPackage[]);
      } finally {
        setLoading(false);
      }
    }

    loadPackages();

    if (!profile) return;

    const channel = supabase
      .channel(`public:admin-packages:${profile.condominium_id}`)
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
  }, [filter, profile]);

  const filteredPackages = useMemo(() => {
    if (!search.trim()) {
      return packages;
    }

    const normalizedSearch = search.trim().toLowerCase();

    return packages.filter((pkg) => {
      const residentName = pkg.resident?.name.toLowerCase() ?? '';
      const residentBlock = pkg.resident?.block.toLowerCase() ?? '';
      const residentApartment = pkg.resident?.apartment.toLowerCase() ?? '';

      return (
        residentName.includes(normalizedSearch) ||
        residentBlock.includes(normalizedSearch) ||
        residentApartment.includes(normalizedSearch)
      );
    });
  }, [packages, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/solicitacoes"
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Solicitações de senha
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Encomendas do condomínio
              </h1>
              <p className="text-gray-500 mt-2">
                Consulte pendentes, entregues e recebimentos do dia com dados reais do Supabase.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por morador, bloco ou apartamento"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSearchParams(option.value === 'all' ? {} : { filter: option.value })}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {filteredPackages.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Package className="w-14 h-14 mx-auto mb-4 text-gray-300" />
              Nenhuma encomenda encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-gray-200 p-5 md:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {pkg.resident?.name ?? 'Morador não encontrado'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Bloco {pkg.resident?.block ?? '-'} - Apto {pkg.resident?.apartment ?? '-'}
                        </p>
                      </div>

                      <p className="text-sm text-gray-500">
                        Recebida em {new Date(pkg.created_at).toLocaleString('pt-BR')}
                      </p>

                      <p className="text-sm text-gray-600">
                        Porteiro que registrou:{' '}
                        <span className="font-medium text-gray-900">
                          {pkg.doorman?.name ?? 'Não identificado'}
                        </span>
                      </p>

                      <p className="text-sm text-gray-600">
                        Situação da notificação:{' '}
                        <span className="font-medium text-gray-900">
                          {getNotificationLabel(pkg.notification_status, pkg.whatsapp_sent)}
                        </span>
                      </p>

                      {pkg.status === 'delivered' ? (
                        <>
                          <p className="text-sm text-gray-600">
                            Retirada em:{' '}
                            <span className="font-medium text-gray-900">
                              {pkg.delivered_at
                                ? new Date(pkg.delivered_at).toLocaleString('pt-BR')
                                : 'Não informada'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Retirada por:{' '}
                            <span className="font-medium text-gray-900">
                              {pkg.delivered_to ?? 'Não informado'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Entrega confirmada por:{' '}
                            <span className="font-medium text-gray-900">
                              {pkg.delivered_by_profile?.name ?? 'Não identificado'}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Status atual:{' '}
                          <span className="font-medium text-gray-900">Aguardando retirada</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-start">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          pkg.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {pkg.status === 'pending' ? 'Pendente' : 'Entregue'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
