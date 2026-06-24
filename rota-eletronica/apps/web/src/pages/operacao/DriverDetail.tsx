import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, CreditCard, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useDriversStore } from '@/store/driversStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import {
  CNH_EXPIRY_BANNER_CLASS,
  CNH_EXPIRY_FIELD_CLASS,
  CNH_EXPIRY_ICON_CLASS,
  CNH_EXPIRY_VALUE_CLASS,
  getCnhExpiryWarning,
} from '@/utils/cnhExpiry';

const STATUS_LABELS: Record<string, string> = { active: 'Ativo', inactive: 'Inativo' };
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

export function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const getDriverById = useDriversStore((s) => s.getDriverById);
  const removeDriver = useDriversStore((s) => s.removeDriver);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const driver = id ? getDriverById(id) : undefined;
  const munNames = driver?.municipalityIds?.length
    ? driver.municipalityIds.map((mid) => municipalitiesList.find((m) => m.id === mid)?.name).filter(Boolean).join(', ')
    : '-';

  if (!driver) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Motorista não encontrado.{' '}
        <Link to="/operacao/motoristas" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  const cnhWarning = getCnhExpiryWarning(driver.licenseExpiry, driver.status);

  const confirmarExcluir = () => {
    if (!id || !driver) return;
    removeDriver(id);
    toast.success('Motorista excluído.');
    setExcluirAberto(false);
    navigate('/operacao/motoristas');
  };

  return (
    <div className="space-y-4">
      <Link
        to="/operacao/motoristas"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
      >
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to={`/operacao/motoristas/editar/${id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </Link>
        <button
          type="button"
          onClick={() => setExcluirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>

      {cnhWarning && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-3 ${CNH_EXPIRY_BANNER_CLASS[cnhWarning.severity]}`}
          role="status"
        >
          <AlertTriangle
            size={24}
            className={`flex-shrink-0 ${CNH_EXPIRY_ICON_CLASS[cnhWarning.severity]}`}
            aria-hidden
          />
          <div>
            <p className="font-medium">
              {cnhWarning.severity === 'expired'
                ? 'Atenção: CNH vencida'
                : 'Atenção: CNH próxima do vencimento'}
            </p>
            <p className="text-sm opacity-95">
              {cnhWarning.label}. Vencimento: {formatDate(driver.licenseExpiry)}.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg font-semibold text-urban-gray-light">{driver.name}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[driver.status] ?? ''}`}>
            {STATUS_LABELS[driver.status] ?? driver.status}
          </span>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <User className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Nome completo</p>
              <p className="text-urban-gray-light text-sm font-medium">{driver.name}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">CPF</p>
            <p className="text-urban-gray-light text-sm font-medium">{driver.cpf}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">ID Funcionário</p>
            <p className="text-urban-gray-light text-sm font-medium">{driver.employeeId}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <MapPin className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Endereço</p>
              <p className="text-urban-gray-light text-sm font-medium">{driver.address || '-'}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Phone className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Telefone</p>
              <p className="text-urban-gray-light text-sm font-medium">{driver.phone || '-'}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Mail className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">E-mail</p>
              <p className="text-urban-gray-light text-sm font-medium">{driver.email || '-'}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 sm:col-span-2">
            <p className="text-urban-gray-data text-xs mb-1">Município(s) de atuação</p>
            <p className="text-urban-gray-light text-sm font-medium">{munNames}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <CreditCard className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
              <div>
                <p className="text-urban-gray-data text-xs mb-1">Número CNH</p>
                <p className="text-urban-gray-light text-sm font-medium">{driver.licenseNumber}</p>
              </div>
              <div>
                <p className="text-urban-gray-data text-xs mb-1">Categoria</p>
                <p className="text-urban-gray-light text-sm font-medium">{driver.licenseCategory}</p>
              </div>
              <div
                className={
                  cnhWarning
                    ? `rounded-md border p-2 -m-2 ${CNH_EXPIRY_FIELD_CLASS[cnhWarning.severity]}`
                    : ''
                }
              >
                <p className="text-urban-gray-data text-xs mb-1 flex items-center gap-1">
                  Vencimento
                  {cnhWarning && (
                    <AlertTriangle
                      size={12}
                      className={CNH_EXPIRY_ICON_CLASS[cnhWarning.severity]}
                      aria-hidden
                    />
                  )}
                </p>
                <p
                  className={`text-sm font-medium ${
                    cnhWarning
                      ? CNH_EXPIRY_VALUE_CLASS[cnhWarning.severity]
                      : 'text-urban-gray-light'
                  }`}
                >
                  {formatDate(driver.licenseExpiry)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir o motorista "${driver.name}"?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
