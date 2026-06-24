import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Bus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useGaragesStore } from '@/store/garagesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
const STATUS_LABELS: Record<string, string> = { active: 'Ativo', maintenance: 'Manutenção', inactive: 'Inativo' };

export function GarageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const getGarageById = useGaragesStore((s) => s.getGarageById);
  const removeGarage = useGaragesStore((s) => s.removeGarage);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const garage = id ? getGarageById(id) : undefined;
  const municipality = garage ? municipalitiesList.find((m) => m.id === garage.municipalityId) : undefined;
  const vehiclesLinked = garage ? getVehicles().filter((v) => v.garageId === garage.id) : [];

  if (!garage) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Garagem não encontrada.{' '}
        <Link to="/garagens" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  const confirmarExcluir = () => {
    if (!id || !garage) return;
    removeGarage(id);
    toast.success('Garagem excluída.');
    setExcluirAberto(false);
    navigate('/garagens');
  };

  return (
    <div className="space-y-4">
      <Link
        to="/garagens"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
      >
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to={`/garagens/editar/${id}`}
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

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5">
          <h1 className="text-lg font-semibold text-urban-gray-light">{garage.name}</h1>
          <p className="text-sm text-urban-gray-data">{municipality?.name ?? '-'}</p>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <MapPin className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Endereço</p>
              <p className="text-urban-gray-light text-sm font-medium">{garage.address}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Município</p>
            <p className="text-urban-gray-light text-sm font-medium">{municipality?.name ?? '-'}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Coordenadas</p>
            <p className="text-urban-gray-light text-sm font-medium">
              {garage.coordinates.lat.toFixed(6)}, {garage.coordinates.lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex items-center gap-2">
          <Bus className="text-urban-green" size={20} />
          <h2 className="text-lg font-semibold text-urban-gray-light">Veículos vinculados</h2>
        </div>
        <div className="p-4">
          {vehiclesLinked.length === 0 ? (
            <p className="text-sm text-urban-gray-data">Nenhum veículo vinculado a esta garagem.</p>
          ) : (
            <ul className="space-y-2">
              {vehiclesLinked.map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/veiculos/${v.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-urban-petrol/20 p-3 hover:bg-white/10 hover:border-urban-green/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-urban-gray-light truncate">{v.plate} — {v.brand} {v.model}</p>
                      <p className="text-xs text-urban-gray-data">{v.year} • {v.capacity} lugares</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-urban-green/20 text-urban-green flex-shrink-0">
                      {STATUS_LABELS[v.status] ?? v.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir a garagem "${garage.name}"?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
