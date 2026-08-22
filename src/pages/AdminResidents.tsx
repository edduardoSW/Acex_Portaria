import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Resident } from '../types';
import { useAuth } from '../contexts/AuthContext';

// Helper to normalize phone numbers
function normalizeWhatsappNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  return normalized;
}

export function AdminResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    block: '',
    apartment: '',
    whatsapp: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  async function loadResidents() {
    if (!profile) return;
    
    const { data } = await supabase
      .from('residents')
      .select('*')
      .eq('condominium_id', profile.condominium_id)
      .order('name');

    if (data) setResidents(data);
    setLoading(false);
  }

  useEffect(() => {
    loadResidents();

    if (!profile) return;

    // Set up real-time subscription
    const channel = supabase
      .channel('public:residents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'residents',
          filter: `condominium_id=eq.${profile.condominium_id}`,
        },
        () => {
          loadResidents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const filteredResidents = residents.filter(r => {
    if (!search) return true;
    const lowerSearch = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(lowerSearch) ||
      r.block.toLowerCase().includes(lowerSearch) ||
      r.apartment.toLowerCase().includes(lowerSearch)
    );
  });

  const handleOpenModal = (resident?: Resident) => {
    setError(null);
    setSuccess(null);
    if (resident) {
      setEditingResident(resident);
      setFormData({
        name: resident.name,
        block: resident.block,
        apartment: resident.apartment,
        whatsapp: resident.whatsapp,
        email: resident.email || '',
        phone: resident.phone || '',
      });
    } else {
      setEditingResident(null);
      setFormData({
        name: '',
        block: '',
        apartment: '',
        whatsapp: '',
        email: '',
        phone: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.name.trim()) throw new Error('Nome é obrigatório');
      if (!formData.block.trim()) throw new Error('Bloco é obrigatório');
      if (!formData.apartment.trim()) throw new Error('Apartamento é obrigatório');
      if (!formData.whatsapp.trim()) throw new Error('WhatsApp é obrigatório');

      const normalizedWhatsapp = normalizeWhatsappNumber(formData.whatsapp);
      if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
        throw new Error('E-mail válido é obrigatório');
      }
      const normalizedPhone = formData.phone ? normalizeWhatsappNumber(formData.phone) : null;

      // Check for duplicate unit (only when creating new or changing unit)
      const isNew = !editingResident;
      const unitChanged = editingResident && (
        formData.block !== editingResident.block || 
        formData.apartment !== editingResident.apartment
      );
      
      if (isNew || unitChanged) {
        const { data: existingUnit, error: checkError } = await supabase
          .from('residents')
          .select('id')
          .eq('condominium_id', profile.condominium_id)
          .eq('block', formData.block.trim())
          .eq('apartment', formData.apartment.trim())
          .maybeSingle();

        if (checkError) throw checkError;
        
        if (existingUnit) {
          throw new Error('Já existe um morador cadastrado para esta unidade (bloco e apartamento)');
        }
      }

      const dataToSave = {
        name: formData.name.trim(),
        block: formData.block.trim(),
        apartment: formData.apartment.trim(),
        whatsapp: normalizedWhatsapp,
        email: formData.email.trim().toLowerCase(),
        phone: normalizedPhone,
        condominium_id: profile.condominium_id,
      };

      if (editingResident) {
        // Update existing resident
        const { error: updateError } = await supabase
          .from('residents')
          .update(dataToSave)
          .eq('id', editingResident.id);
        if (updateError) throw updateError;
        setSuccess('Morador atualizado com sucesso!');
      } else {
        // Create new resident
        const { error: insertError } = await supabase
          .from('residents')
          .insert(dataToSave);
        if (insertError) throw insertError;
        setSuccess('Morador cadastrado com sucesso!');
      }
      
      await loadResidents();
      
      // Close modal after a short delay to show success
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
      }, 1500);
      
    } catch (err) {
      console.error('Erro ao salvar morador:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao salvar o morador');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (residentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este morador?')) return;

    setError(null);
    try {
      // Check if resident has packages
      const { data: existingPackages } = await supabase
        .from('packages')
        .select('id')
        .eq('resident_id', residentId)
        .limit(1);

      if (existingPackages && existingPackages.length > 0) {
        setError('Este morador tem encomendas associadas e não pode ser excluído');
        return;
      }

      const { error } = await supabase
        .from('residents')
        .delete()
        .eq('id', residentId);
      
      if (error) throw error;

      await loadResidents();
      setSuccess('Morador excluído com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erro ao excluir morador:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao excluir o morador');
      }
    }
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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Moradores</h1>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Morador
          </button>
        </div>

        {/* Success/Error alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Busque por nome, bloco ou apartamento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="space-y-3">
            {filteredResidents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum morador encontrado</p>
            ) : (
              filteredResidents.map((resident) => (
                <div key={resident.id} className="p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{resident.name}</p>
                    <p className="text-gray-600 text-sm">
                      Bloco {resident.block} - Apto {resident.apartment}
                    </p>
                    <p className="text-gray-500 text-sm">
                      WhatsApp: {resident.whatsapp}
                    </p>
                    <p className="text-gray-500 text-sm">E-mail cadastrado</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(resident)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(resident.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editingResident ? 'Editar Morador' : 'Novo Morador'}
              </h2>
              
              {/* Modal alerts */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-green-700 text-sm">{success}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Bloco</label>
                    <input
                      type="text"
                      required
                      value={formData.block}
                      onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Apartamento</label>
                    <input
                      type="text"
                      required
                      value={formData.apartment}
                      onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">E-mail</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Telefone (opcional)</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Salvando...
                      </span>
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
