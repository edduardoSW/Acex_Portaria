import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PackageWithResident } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Filter = 'all' | 'pending' | 'delivered';

export function History() {
  const [packages, setPackages] = useState<PackageWithResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    async function loadPackages() {
      if (!profile) return;

      let query = supabase
        .from('packages')
        .select(`
          *,
          resident:residents(*)
        `)
        .eq('condominium_id', profile.condominium_id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data } = await query;

      if (data) setPackages(data as unknown as PackageWithResident[]);
      
      setLoading(false);
    }

    loadPackages();

    if (!profile) return;

    // Set up real-time subscription
    const channel = supabase
      .channel('public:packages-history')
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
  }, [profile, filter]);

  const filteredPackages = packages.filter(pkg => {
    if (!search) return true;
    const lowerSearch = search.toLowerCase();
    return (
      pkg.resident.name.toLowerCase().includes(lowerSearch) ||
      pkg.resident.block.toLowerCase().includes(lowerSearch) ||
      pkg.resident.apartment.toLowerCase().includes(lowerSearch)
    );
  });

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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Histórico</h1>

          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Busque por nome, bloco ou apartamento"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilter('delivered')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  filter === 'delivered' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Entregues
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredPackages.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum resultado encontrado</p>
            ) : (
              filteredPackages.map((pkg) => (
                <div key={pkg.id} className="p-4 rounded-xl border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{pkg.resident.name}</p>
                      <p className="text-gray-600 text-sm">
                        Bloco {pkg.resident.block} - Apto {pkg.resident.apartment}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {new Date(pkg.created_at).toLocaleDateString('pt-BR')} às {new Date(pkg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {pkg.status === 'delivered' && pkg.delivered_to && pkg.delivered_at && (
                        <p className="text-green-600 text-sm mt-1">
                          Retirado por {pkg.delivered_to} em {new Date(pkg.delivered_at).toLocaleDateString('pt-BR')} às {new Date(pkg.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
