import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSchedulesStore } from '@/store/schedulesStore';
import { useRoutesStore } from '@/store/routesStore';
import { useDriversStore } from '@/store/driversStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { DateInput } from '@/components/forms/DateInput';
import { api } from '@/services/api';
import type { Schedule } from '@rota-eletronica/shared-types';
import { shiftLabel } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};
const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-urban-gray-data/20 text-urban-gray-data',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-urban-green/20 text-urban-green',
  cancelled: 'bg-red-500/20 text-red-400',
};
function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

function weekdayLabelPt(isoDate: string) {
  if (!isoDate) return '—';
  try {
    const d = new Date(`${isoDate.includes('T') ? isoDate.slice(0, 10) : isoDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '—';
  }
}

export function EscalasList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriarEscala = authUser && pode(authUser, 'escalas', 'criar');
  const podeEditarEscala = authUser && pode(authUser, 'escalas', 'editar');
  const podeExcluirEscala = authUser && pode(authUser, 'escalas', 'excluir');
  const removeSchedule = useSchedulesStore((s) => s.removeSchedule);
  const fetchSchedulesFull = useSchedulesStore((s) => s.fetchSchedules);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const getDrivers = useDriversStore((s) => s.getDrivers);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const routesList = getRoutes();
  const driversList = getDrivers();
  const vehiclesList = getVehicles();
  const schoolsList = getSchools();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Schedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.schedules
      .list(undefined, { page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Schedule>(res)) {
          setItems(res.data);
          setTotal(res.total);
        } else {
          setItems(Array.isArray(res) ? (res as Schedule[]) : []);
          setTotal(Array.isArray(res) ? (res as Schedule[]).length : 0);
        }
        void fetchSchedulesFull(undefined, { silent: true });
      })
      .catch(() => {
        if (!cancelled) setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, fetchSchedulesFull]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeSchedule(deleteTarget.id);
      toast.success('Escala excluída.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/escalas');
    } catch {
      toast.error('Erro ao excluir escala.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        const route = routesList.find((r) => r.id === s.routeId);
        const driver = driversList.find((d) => d.id === s.driverId);
        const school = route ? schoolsList.find((sc) => sc.id === route.schoolId) : undefined;
        return (
          s.name.toLowerCase().includes(q) ||
          (route?.name && route.name.toLowerCase().includes(q)) ||
          (school?.name && school.name.toLowerCase().includes(q)) ||
          (driver?.name && driver.name.toLowerCase().includes(q))
        );
      });
    }
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((s) => {
        const route = routesList.find((r) => r.id === s.routeId);
        return route ? municipalityIdsByState.has(route.municipalityId) : false;
      });
    }
    if (munFilter) {
      list = list.filter((s) => {
        const route = routesList.find((r) => r.id === s.routeId);
        return route?.municipalityId === munFilter;
      });
    }
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (dateFrom) list = list.filter((s) => s.date >= dateFrom);
    if (dateTo) list = list.filter((s) => s.date <= dateTo);
    return list;
  }, [items, routesList, driversList, schoolsList, municipalitiesList, search, stateFilter, munFilter, statusFilter, dateFrom, dateTo]);

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

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunFilter('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageItems = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Escalas</h2>
        {podeCriarEscala && (
          <Link
            to="/escalas/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Nova Escala
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, rota, escola ou motorista..."
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
          onChange={(e) => { setMunFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os municípios</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-urban-petrol/50 bg-white/5 px-3 py-2"
          title="Filtrar por intervalo de datas da escala"
        >
          <span className="text-base text-urban-gray-light whitespace-nowrap hidden sm:inline">Período</span>
          <div className="w-[6.75rem] sm:w-[7rem] shrink-0">
            <DateInput
              id="escalas-filter-date-from"
              value={dateFrom}
              onChange={(v) => {
                setDateFrom(v);
                setPage(1);
              }}
              placeholder="__/__/____"
              suppressValidation
              className="w-full px-1.5 py-1 rounded bg-transparent border-0 text-base text-urban-gray-light placeholder:text-urban-gray-data focus:outline-none focus:ring-1 focus:ring-urban-green/60"
            />
          </div>
          <span className="text-base text-urban-gray-light shrink-0">até</span>
          <div className="w-[6.75rem] sm:w-[7rem] shrink-0">
            <DateInput
              id="escalas-filter-date-to"
              value={dateTo}
              onChange={(v) => {
                setDateTo(v);
                setPage(1);
              }}
              placeholder="__/__/____"
              suppressValidation
              className="w-full px-1.5 py-1 rounded bg-transparent border-0 text-base text-urban-gray-light placeholder:text-urban-gray-data focus:outline-none focus:ring-1 focus:ring-urban-green/60"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os status</option>
          {(['scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((st) => (
            <option key={st} value={st}>{STATUS_LABELS[st]}</option>
          ))}
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
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3">Dia da semana</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((s) => {
                const route = routesList.find((r) => r.id === s.routeId);
                const school = route ? schoolsList.find((sc) => sc.id === route.schoolId) : undefined;
                const municipality = route ? municipalitiesList.find((m) => m.id === route.municipalityId) : undefined;
                const driver = driversList.find((d) => d.id === s.driverId);
                const vehicle = vehiclesList.find((v) => v.id === s.vehicleId);
                const displayName = `${s.name.trim()}${school ? ` (${school.name})` : ''}`;
                const isFrequency = s.scheduleKind === 'frequency';
                return (
                  <tr key={s.id} className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5">
                    <td className="px-4 py-3 font-medium max-w-[260px] truncate" title={displayName}>{displayName}</td>
                    <td className="px-4 py-3">
                      {route ? <Link to={`/roteirizacao/${route.id}`} className="text-urban-green hover:underline">{route.name}</Link> : '-'}
                    </td>
                    <td className="px-4 py-3">{municipality?.name ?? '-'}</td>
                    <td className="px-4 py-3">{weekdayLabelPt(s.date)}</td>
                    <td className="px-4 py-3">{isFrequency ? '—' : formatDate(s.date)}</td>
                    <td className="px-4 py-3">{shiftLabel(s.shift)}</td>
                    <td className="px-4 py-3">{driver?.name ?? '-'}</td>
                    <td className="px-4 py-3">{vehicle ? `${vehicle.plate}` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[s.status] ?? ''}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/escalas/${s.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditarEscala && (
                          <Link to={`/escalas/editar/${s.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluirEscala && (
                          <button type="button" onClick={() => setDeleteTarget({ id: s.id, name: s.name })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhuma escala encontrada.</div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-urban-gray-data">
            {tablePaginationSummary(filtered.length, page, totalPages, total)}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light disabled:opacity-50 disabled:cursor-not-allowed">Próxima</button>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Excluir a escala "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}
