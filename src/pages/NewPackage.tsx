import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2, MessageSquare, Package, List, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Resident, Package as PackageType, Condominium } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { NotificationService } from "../lib/notification-service";

const notificationService = new NotificationService();

export function NewPackage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [condominium, setCondominium] = useState<Condominium | null>(null);
  const [search, setSearch] = useState("");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const [whatsAppOpened, setWhatsAppOpened] = useState(false);
  const [packageData, setPackageData] = useState<PackageType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!profile) return;

      // Load residents
      const { data: residentsData } = await supabase
        .from("residents")
        .select("*")
        .eq("condominium_id", profile.condominium_id)
        .order("name");

      if (residentsData) {
        setResidents(residentsData);
        setFilteredResidents(residentsData);
      }

      // Load condominium
      const { data: condoData } = await supabase
        .from("condominiums")
        .select("*")
        .eq("id", profile.condominium_id)
        .single();

      if (condoData) {
        setCondominium(condoData);
      }

      setLoading(false);
    }

    loadData();

    if (!profile) return;

    // Set up real-time subscription
    const channel = supabase
      .channel("public:residents-new-package")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "residents",
          filter: `condominium_id.eq.${profile.condominium_id}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    if (!search) {
      setFilteredResidents(residents);
      return;
    }

    const lowerSearch = search.toLowerCase();
    const filtered = residents.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerSearch) ||
        r.block.toLowerCase().includes(lowerSearch) ||
        r.apartment.toLowerCase().includes(lowerSearch)
    );
    setFilteredResidents(filtered);
  }, [search, residents]);

  // Auto-open WhatsApp when package is registered successfully
  useEffect(() => {
    if (success && packageData && selectedResident && condominium && profile) {
      const openWhatsApp = async () => {
        const opened = await notificationService.sendPackageNotification(
          packageData,
          selectedResident,
          condominium,
          profile.id
        );
        setWhatsAppOpened(opened);
      };
      openWhatsApp();
    }
  }, [success, packageData, selectedResident, condominium, profile]);

  const handleResidentSelect = (resident: Resident) => {
    setSelectedResident(resident);
    setError(null);
  };

  const handleRegisterPackage = async () => {
    if (!selectedResident || !profile || !condominium) return;

    setError(null);
    setRegistering(true);

    try {
      // Insert the package first
      const { data: pkgData, error: packageError } = await supabase
        .from("packages")
        .insert({
          resident_id: selectedResident.id,
          status: "pending",
          registered_by: profile.id,
          condominium_id: profile.condominium_id,
          whatsapp_sent: false,
          notification_status: "pending",
        })
        .select()
        .single();

      if (packageError) throw packageError;

      // Create activity log for package creation
      await notificationService.logActivity("package_created", profile.id, profile.condominium_id, pkgData.id);

      setPackageData(pkgData);
      setSuccess(true);
    } catch (error: any) {
      console.error("Error registering package:", error);
      const errorMessage = 
        error instanceof Error 
          ? error.message 
          : (error?.message || "Ocorreu um erro ao registrar a encomenda");
      setError(errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  const handleNotifyWhatsApp = async () => {
    if (!packageData || !selectedResident || !condominium || !profile) return;
    const opened = await notificationService.sendPackageNotification(packageData, selectedResident, condominium, profile.id);
    setWhatsAppOpened(opened);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Encomenda registrada com sucesso.</h2>
            
            <p className="text-gray-600 mb-4">
              {whatsAppOpened 
                ? "WhatsApp aberto com a mensagem pronta." 
                : "Não foi possível abrir o WhatsApp automaticamente."}
            </p>
            
            <div className="space-y-4 mb-8">
              <button
                onClick={handleNotifyWhatsApp}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Avisar novamente pelo WhatsApp
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setSelectedResident(null);
                  setWhatsAppOpened(false);
                  setPackageData(null);
                  setError(null);
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                Nova Encomenda
              </button>
              <button
                onClick={() => navigate("/pending")}
                className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <List className="w-5 h-5" />
                Pendentes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nova encomenda</h1>
        <p className="text-gray-600 mb-8">Selecione o morador que recebeu a encomenda</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {selectedResident ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Morador selecionado</h3>
            <div className="space-y-2 mb-6">
              <p className="text-gray-600">
                <span className="font-medium">Nome:</span> {selectedResident.name}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Unidade:</span> Bloco {selectedResident.block}, Apto {selectedResident.apartment}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">WhatsApp:</span> {selectedResident.whatsapp}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedResident(null)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Trocar morador
              </button>
              <button
                onClick={handleRegisterPackage}
                disabled={registering}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registrando...
                  </span>
                ) : "Registrar encomenda"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
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
            </div>

            <div className="max-h-96 overflow-y-auto">
              {filteredResidents.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">Nenhum morador encontrado</p>
                </div>
              ) : (
                filteredResidents.map((resident) => (
                  <button
                    key={resident.id}
                    onClick={() => handleResidentSelect(resident)}
                    className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{resident.name}</p>
                    <p className="text-sm text-gray-500">
                      Bloco {resident.block} - Apto {resident.apartment}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
