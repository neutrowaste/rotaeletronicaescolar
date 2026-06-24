import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, MapPin, FileCheck, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import {
  getInspectionExpiryWarning,
  INSPECTION_EXPIRY_BANNER_CLASS,
  INSPECTION_EXPIRY_FIELD_CLASS,
  INSPECTION_EXPIRY_ICON_CLASS,
  INSPECTION_EXPIRY_VALUE_CLASS,
} from '@/utils/inspectionExpiry';

const TRANSPORT_TYPE_LABELS: Record<string, string> = {
  escolar: 'Escolar',
  saude: 'Saúde',
  nao_informado: 'Não informado',
};


const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Manutenção',
  inactive: 'Inativo',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  maintenance: 'bg-amber-500/20 text-amber-400',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const getVehicleById = useVehiclesStore((s) => s.getVehicleById);
  const removeVehicle = useVehiclesStore((s) => s.removeVehicle);
  const getGarageById = useGaragesStore((s) => s.getGarageById);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const vehicle = id ? getVehicleById(id) : undefined;
  const municipality = vehicle ? municipalitiesList.find((m) => m.id === vehicle.municipalityId) : undefined;
  const garage = vehicle ? getGarageById(vehicle.garageId) : undefined;

  if (!vehicle) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Veículo não encontrado.{' '}
        <Link to="/veiculos" className="text-urban-green hover:underline">
          Voltar à listagem
        </Link>
      </div>
    );
  }

  const inspectionWarning = getInspectionExpiryWarning(vehicle.lastInspectionDate, vehicle.status);

  const confirmarExcluir = () => {
    if (!id || !vehicle) return;
    removeVehicle(id);
    toast.success('Veículo excluído.');
    setExcluirAberto(false);
    navigate('/veiculos');
  };

  return (
    <div className="space-y-4">
      <Link
        to="/veiculos"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
      >
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to={`/veiculos/editar/${id}`}
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

      {inspectionWarning && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-3 ${INSPECTION_EXPIRY_BANNER_CLASS[inspectionWarning.severity]}`}
          role="status"
        >
          <AlertTriangle
            size={24}
            className={`flex-shrink-0 ${INSPECTION_EXPIRY_ICON_CLASS[inspectionWarning.severity]}`}
            aria-hidden
          />
          <div>
            <p className="font-medium">
              {inspectionWarning.severity === 'expired'
                ? 'Atenção: inspeção vencida'
                : 'Atenção: inspeção próxima do vencimento'}
            </p>
            <p className="text-sm opacity-95">
              {inspectionWarning.label}. Validade até: {formatDate(inspectionWarning.expiryDate)}.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-urban-green/20 flex items-center justify-center">
              <Bus className="text-urban-green" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-urban-gray-light">
                {vehicle.plate} — {vehicle.brand} {vehicle.model}
              </h1>
              <p className="text-sm text-urban-gray-data">
                {vehicle.year} • {vehicle.color} • {vehicle.capacity} lugares
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[vehicle.status] ?? ''}`}
          >
            {STATUS_LABELS[vehicle.status] ?? vehicle.status}
          </span>
        </div>

        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <MapPin className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <p className="text-urban-gray-data text-xs">Garagem</p>
              <p className="text-urban-gray-light text-sm font-medium">{garage?.name ?? '-'}</p>
              {garage?.address && (
                <p className="text-urban-gray-data text-xs mt-0.5">{garage.address}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Município</p>
            <p className="text-urban-gray-light text-sm font-medium">{municipality?.name ?? '-'}</p>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Tipo de transporte</p>
            <p className="text-urban-gray-light text-sm font-medium">{TRANSPORT_TYPE_LABELS[vehicle.transportType ?? 'nao_informado'] ?? 'Não informado'}</p>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Rotas vinculadas</p>
            <p className="text-urban-gray-light text-sm font-medium">{vehicle.routesCount}</p>
          </div>

          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <FileCheck className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0 space-y-2">
              <p className="text-urban-gray-data text-xs">Documentação</p>
              <div className="grid gap-1 text-sm">
                <p className="text-urban-gray-light">
                  <span className="text-urban-gray-data">RENAVAM:</span> {vehicle.renavam}
                </p>
                <p className="text-urban-gray-light">
                  <span className="text-urban-gray-data">Chassis:</span> {vehicle.chassis}
                </p>
                <p
                  className={
                    inspectionWarning
                      ? `rounded-md border px-2 py-1.5 -mx-2 ${INSPECTION_EXPIRY_FIELD_CLASS[inspectionWarning.severity]}`
                      : 'text-urban-gray-light'
                  }
                >
                  <span className="text-urban-gray-data inline-flex items-center gap-1">
                    Última inspeção:
                    {inspectionWarning && (
                      <AlertTriangle
                        size={12}
                        className={INSPECTION_EXPIRY_ICON_CLASS[inspectionWarning.severity]}
                        aria-hidden
                      />
                    )}
                  </span>{' '}
                  <span
                    className={
                      inspectionWarning
                        ? `font-medium ${INSPECTION_EXPIRY_VALUE_CLASS[inspectionWarning.severity]}`
                        : ''
                    }
                  >
                    {formatDate(vehicle.lastInspectionDate)}
                  </span>
                  {inspectionWarning && (
                    <span
                      className={`block text-xs mt-0.5 ${INSPECTION_EXPIRY_VALUE_CLASS[inspectionWarning.severity]}`}
                    >
                      Validade até: {formatDate(inspectionWarning.expiryDate)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir o veículo ${vehicle.plate}?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
