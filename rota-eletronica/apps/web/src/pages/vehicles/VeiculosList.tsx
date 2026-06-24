import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { api } from '@/services/api';
import type { Vehicle } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';
import {
  getInspectionExpiryWarning,
  INSPECTION_EXPIRY_ICON_CLASS,
} from '@/utils/inspectionExpiry';

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

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

export function VeiculosList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'veiculos', 'criar');
  const podeEditar = authUser && pode(authUser, 'veiculos', 'editar');
  const podeExcluir = authUser && pode(authUser, 'veiculos', 'excluir');
  const removeVehicle = useVehiclesStore((s) => s.removeVehicle);
  const getGarages = useGaragesStore((s) => s.getGarages);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const garagesList = getGarages();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plate: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [garageFilter, setGarageFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.vehicles
      .list(munFilter || undefined, { page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Vehicle>(res)) {
          setItems(res.data);
          setTotal(res.total);
        } else {
          setItems(Array.isArray(res) ? (res as Vehicle[]) : []);
          setTotal(Array.isArray(res) ? (res as Vehicle[]).length : 0);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, munFilter]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeVehicle(deleteTarget.id);
      toast.success('Veículo excluído.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/veiculos');
    } catch {
      toast.error('Erro ao excluir veículo.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q)
      );
    }
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((v) => municipalityIdsByState.has(v.municipalityId));
    }
    if (munFilter) list = list.filter((v) => v.municipalityId === munFilter);
    if (garageFilter) list = list.filter((v) => v.garageId === garageFilter);
    if (typeFilter) list = list.filter((v) => (v.transportType ?? 'nao_informado') === typeFilter);
    if (statusFilter) list = list.filter((v) => v.status === statusFilter);
    return list;
  }, [items, search, stateFilter, munFilter, garageFilter, typeFilter, statusFilter, municipalitiesList]);

  const stateOptions = useMemo(
    () => Array.from(new Set(municipalitiesList.map((m) => m.state))).sort(),
    [municipalitiesList]
  );

  const municipalityOptions = useMemo(() => {
    const list = stateFilter
      ? municipalitiesList.filter((m) => m.state === stateFilter)
      : municipalitiesList;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [municipalitiesList, stateFilter]);

  const garageOptions = useMemo(() => {
    let list = garagesList;
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((g) => municipalityIdsByState.has(g.municipalityId));
    }
    if (munFilter) list = list.filter((g) => g.municipalityId === munFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [garagesList, municipalitiesList, stateFilter, munFilter]);

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunFilter('');
    setGarageFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageVehicles = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Veículos</h2>
        {podeCriar && (
          <Link
            to="/veiculos/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Novo Veículo
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por placa, marca ou modelo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setMunFilter('');
            setGarageFilter('');
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os estados</option>
          {stateOptions.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
        <select
          value={munFilter}
          onChange={(e) => {
            setMunFilter(e.target.value);
            setGarageFilter('');
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os municípios</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={garageFilter}
          onChange={(e) => {
            setGarageFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todas as garagens</option>
          {garageOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os tipos</option>
          <option value="escolar">Escolar</option>
          <option value="saude">Saúde</option>
          <option value="nao_informado">Não informado</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="maintenance">Manutenção</option>
          <option value="inactive">Inativo</option>
        </select>
        <button
          type="button"
          onClick={clearFilters}
          className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors"
        >
          Limpar filtros
        </button>
      </div>

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        {loading && <div className="px-4 py-8 text-center text-urban-gray-data">Carregando...</div>}
        {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-urban-gray-data border-b border-urban-petrol/30 bg-white/5">
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Marca / Modelo</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Capacidade</th>
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3">Garagem</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Rotas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageVehicles.map((v) => {
                const mun = municipalitiesList.find((m) => m.id === v.municipalityId);
                const garage = garagesList.find((g) => g.id === v.garageId);
                const inspectionWarning = getInspectionExpiryWarning(v.lastInspectionDate, v.status);
                const inspectionAlertTitle = inspectionWarning
                  ? `${inspectionWarning.label} (validade até: ${formatDate(inspectionWarning.expiryDate)})`
                  : '';
                return (
                  <tr
                    key={v.id}
                    className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        {inspectionWarning && (
                          <span className="flex-shrink-0 inline-flex cursor-help" title={inspectionAlertTitle}>
                            <AlertTriangle
                              className={INSPECTION_EXPIRY_ICON_CLASS[inspectionWarning.severity]}
                              size={18}
                              strokeWidth={2}
                              aria-label={inspectionAlertTitle}
                            />
                          </span>
                        )}
                        <span className="truncate min-w-0 flex-1">{v.plate}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {v.brand} — {v.model}
                    </td>
                    <td className="px-4 py-3">{v.year}</td>
                    <td className="px-4 py-3">{v.capacity} lugares</td>
                    <td className="px-4 py-3">{mun?.name ?? '-'}</td>
                    <td className="px-4 py-3">{garage?.name ?? '-'}</td>
                    <td className="px-4 py-3">{TRANSPORT_TYPE_LABELS[v.transportType ?? 'nao_informado'] ?? '-'}</td>
                    <td className="px-4 py-3">{v.routesCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[v.status] ?? ''}`}
                      >
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/veiculos/${v.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditar && (
                          <Link to={`/veiculos/editar/${v.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluir && (
                          <button type="button" onClick={() => setDeleteTarget({ id: v.id, plate: v.plate })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhum veículo encontrado.</div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-urban-gray-data">
            {tablePaginationSummary(filtered.length, page, totalPages, total)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Excluir o veículo "${deleteTarget.plate}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}
