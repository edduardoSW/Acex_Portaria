import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Package, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { pickupCodeService } from '../lib/pickup-code-service';
import { useAuth } from '../contexts/AuthContext';
import { Resident } from '../types';

export function NewPackage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [search, setSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ emailSent: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registrationInProgress = useRef(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    async function loadResidents() {
      if (!profile) return;
      const { data, error: loadError } = await supabase.from('residents').select('*')
        .eq('condominium_id', profile.condominium_id).order('name');
      if (loadError) setError('Não foi possível carregar os moradores');
      if (data) setResidents(data);
      setLoading(false);
    }
    loadResidents();
  }, [profile]);

  const filteredResidents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return residents;
    return residents.filter((resident) =>
      resident.name.toLowerCase().includes(term) ||
      resident.block.toLowerCase().includes(term) ||
      resident.apartment.toLowerCase().includes(term));
  }, [residents, search]);

  async function registerPackage() {
    if (!selectedResident || registrationInProgress.current) return;
    registrationInProgress.current = true;
    setError(null);
    setRegistering(true);
    try {
      const response = await pickupCodeService.create(selectedResident.id);
      setResult({ emailSent: Boolean(response.emailSent), message: response.message });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a encomenda');
    } finally {
      registrationInProgress.current = false;
      setRegistering(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Encomenda registrada</h2>
          <div className={`mb-8 rounded-xl border p-4 ${result.emailSent ? 'border-green-200 bg-green-50 text-green-800' : 'border-yellow-200 bg-yellow-50 text-yellow-800'}`}>
            <Mail className="mx-auto mb-2 h-6 w-6" />
            {result.emailSent ? 'Código de retirada enviado por e-mail com sucesso.' : result.message}
            <p className="mt-2 text-sm">O código permanece oculto para o porteiro.</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => { setResult(null); setSelectedResident(null); }} className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2"><Package className="w-5 h-5" />Nova encomenda</button>
            <button onClick={() => navigate('/pendentes')} className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100">Ver pendentes</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"><ArrowLeft className="w-5 h-5" />Voltar</button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nova encomenda</h1>
        <p className="text-gray-600 mb-8">Selecione o morador destinatário</p>
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3"><AlertCircle className="w-5 h-5 text-red-600 shrink-0" /><p className="text-red-800">{error}</p></div>}
        {selectedResident ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Morador selecionado</h3>
            <p className="font-medium text-gray-900">{selectedResident.name}</p>
            <p className="text-gray-600 mb-6">Bloco {selectedResident.block}, Apto {selectedResident.apartment}</p>
            <div className="flex gap-3">
              <button onClick={() => setSelectedResident(null)} className="flex-1 py-3 border border-gray-300 rounded-xl">Trocar</button>
              <button onClick={registerPackage} disabled={registering} className="flex-1 py-3 bg-blue-600 text-white rounded-xl disabled:opacity-50">
                {registering ? <span className="flex justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Registrando...</span> : 'Registrar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 border-b"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, bloco ou apartamento" className="w-full pl-12 pr-4 py-3 border rounded-xl" /></div></div>
            <div className="max-h-96 overflow-y-auto">
              {filteredResidents.map((resident) => <button key={resident.id} onClick={() => setSelectedResident(resident)} className="w-full p-4 text-left hover:bg-gray-50 border-b last:border-0"><p className="font-medium">{resident.name}</p><p className="text-sm text-gray-500">Bloco {resident.block} - Apto {resident.apartment}</p></button>)}
              {!filteredResidents.length && <p className="p-8 text-center text-gray-500">Nenhum morador encontrado</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
