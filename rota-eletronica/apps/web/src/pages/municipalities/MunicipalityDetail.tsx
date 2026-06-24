import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, User, Phone, Mail, FileText, AlertTriangle, Pencil, Trash2, School, Users, Bus, Route, RefreshCw, Map } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useStudentsStore } from '@/store/studentsStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useRoutesStore } from '@/store/routesStore';
import { useMapFiltersStore } from '@/store/mapFiltersStore';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { DateInput } from '@/components/forms/DateInput';
import { getContractExpiryWarning } from '@/utils/contractExpiry';
import { getMunicipalityCounts } from '@/utils/municipalityCounts';
import { resolvePublicAssetUrl } from '@/utils/publicAssetUrl';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

export function MunicipalityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getMunicipalityById = useMunicipalitiesStore((s) => s.getMunicipalityById);
  const updateMunicipality = useMunicipalitiesStore((s) => s.updateMunicipality);
  const removeMunicipality = useMunicipalitiesStore((s) => s.removeMunicipality);
  const getStudents = useStudentsStore((s) => s.getStudents);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const municipality = id ? getMunicipalityById(id) : undefined;
  const counts = id
    ? getMunicipalityCounts(id, getStudents(), getSchools(), getVehicles(), getRoutes())
    : null;
  const setFiltersFromRecord = useMapFiltersStore((s) => s.setFiltersFromRecord);

  if (!municipality) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Município não encontrado.{' '}
        <Link to="/municipios" className="text-urban-green hover:underline">
          Voltar à listagem
        </Link>
      </div>
    );
  }

  const expiryWarning = getContractExpiryWarning(municipality.contractEnd);
  const isContractExpired = expiryWarning?.severity === 'expired';

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [newContractStart, setNewContractStart] = useState('');
  const [newContractEnd, setNewContractEnd] = useState('');
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [excluirLoading, setExcluirLoading] = useState(false);

  const handleOpenRenew = () => {
    setNewContractStart('');
    setNewContractEnd('');
    setShowRenewModal(true);
  };

  const handleConfirmRenew = async () => {
    if (!newContractStart.trim() || !newContractEnd.trim()) {
      toast.error('Informe o início e o fim do novo contrato.');
      return;
    }
    const start = new Date(newContractStart);
    const end = new Date(newContractEnd);
    if (end < start) {
      toast.error('A data de fim deve ser posterior à data de início.');
      return;
    }
    const history = [...(municipality.contractHistory ?? [])];
    history.push({
      contractStart: municipality.contractStart,
      contractEnd: municipality.contractEnd,
    });
    const updated = {
      ...municipality,
      contractStart: newContractStart,
      contractEnd: newContractEnd,
      contractHistory: history,
    };
    try {
      await updateMunicipality(updated);
      toast.success('Novo contrato registrado.');
      setShowRenewModal(false);
    } catch {
      toast.error('Erro ao atualizar contrato.');
    }
  };

  const confirmarExcluir = async () => {
    if (!id || !municipality) return;
    setExcluirLoading(true);
    try {
      await removeMunicipality(id);
      toast.success('Município excluído.');
      setExcluirAberto(false);
      navigate('/municipios');
    } catch {
      toast.error('Erro ao excluir município.');
    } finally {
      setExcluirLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        to="/municipios"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
      >
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          to={`/municipios/editar/${id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </Link>
        <button
          type="button"
          onClick={() => {
            setFiltersFromRecord({ municipalityId: municipality.id });
            navigate('/mapa');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Map size={14} /> Ver no mapa
        </button>
        <button
          type="button"
          onClick={() => setExcluirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>

      {expiryWarning && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-3 ${
            expiryWarning.severity === 'expired'
              ? 'bg-red-100 border-red-300 text-red-800'
              : expiryWarning.severity === '1month'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <AlertTriangle size={24} className="flex-shrink-0" />
          <div>
            <p className="font-medium">Atenção: contrato próximo do vencimento</p>
            <p className="text-sm opacity-95">{expiryWarning.label}. Fim do contrato: {formatDate(municipality.contractEnd)}.</p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {municipality.brasaoUrl?.trim() ? (
              <div className="w-12 h-12 rounded-lg bg-white border border-urban-petrol/25 flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                <img
                  src={resolvePublicAssetUrl(municipality.brasaoUrl.trim())}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  aria-hidden
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-urban-green/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="text-urban-green" size={24} />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-urban-gray-light">
                {municipality.name} — {municipality.state}
              </h1>
              <p className="text-sm text-urban-gray-data">
                Código IBGE: {municipality.ibgeCode}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[municipality.status] ?? ''}`}
          >
            {STATUS_LABELS[municipality.status] ?? municipality.status}
          </span>
        </div>

        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <User className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs">Responsável</p>
              <p className="text-urban-gray-light text-sm font-medium">{municipality.responsible}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <FileText className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs">Cargo/Função</p>
              <p className="text-urban-gray-light text-sm font-medium">{municipality.responsibleRole ?? '-'}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Phone className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs">Telefone</p>
              <p className="text-urban-gray-light text-sm font-medium">{municipality.phone}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Mail className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs">E-mail</p>
              <p className="text-urban-gray-light text-sm font-medium">{municipality.email}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <School className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs mb-1">Total de escolas</p>
              <p className="text-urban-gray-light text-sm font-medium">{counts?.totalSchools ?? 0}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Users className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs mb-1">Total de alunos</p>
              <p className="text-urban-gray-light text-sm font-medium">{counts?.totalStudents ?? 0}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Bus className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs mb-1">Total de veículos</p>
              <p className="text-urban-gray-light text-sm font-medium">{counts?.totalVehicles ?? 0}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Route className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs mb-1">Total de rotas</p>
              <p className="text-urban-gray-light text-sm font-medium">{counts?.totalRoutes ?? 0}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <FileText className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs mb-1">Período do contrato</p>
              <p className="text-urban-gray-light text-sm font-medium">
                {formatDate(municipality.contractStart)} a {formatDate(municipality.contractEnd)}
              </p>
            </div>
          </div>
          {isContractExpired && (
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={handleOpenRenew}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium"
              >
                <RefreshCw size={14} /> Renovar contrato
              </button>
            </div>
          )}
          {(municipality.contractHistory?.length ?? 0) > 0 && (
            <div className="sm:col-span-2 rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
              <p className="text-urban-gray-data text-xs mb-2 font-medium">Histórico de contratos</p>
              <ul className="space-y-1 text-sm text-urban-gray-light">
                {municipality.contractHistory!.map((c, i) => (
                  <li key={i}>
                    {formatDate(c.contractStart)} a {formatDate(c.contractEnd)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {showRenewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowRenewModal(false)}>
          <div className="rounded-card bg-sidebar border border-urban-petrol/30 p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-urban-gray-light font-medium mb-4">Novo contrato</h3>
            <p className="text-urban-gray-data text-sm mb-4">Informe o período do novo contrato com o município.</p>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <label className="block text-xs text-urban-gray-data mb-1">Início</label>
                <DateInput
                  value={newContractStart}
                  onChange={setNewContractStart}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
                />
              </div>
              <div>
                <label className="block text-xs text-urban-gray-data mb-1">Fim</label>
                <DateInput
                  value={newContractEnd}
                  onChange={setNewContractEnd}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenewModal(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRenew}
                className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir o município "${municipality.name}"?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={() => void confirmarExcluir()}
        confirming={excluirLoading}
      />
    </div>
  );
}
