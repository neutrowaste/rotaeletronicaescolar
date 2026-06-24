import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoutesStore } from '@/store/routesStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useStudentsStore } from '@/store/studentsStore';
import { formatDuration } from '@rota-eletronica/shared-utils';
import { api } from '@/services/api';
import type { Route } from '@rota-eletronica/shared-types';
import { matchesShiftFilter, shiftLabel } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-urban-green/20 text-urban-green',
};

export function RoutingList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'roteirizacao', 'criar');
  const podeEditar = authUser && pode(authUser, 'roteirizacao', 'editar');
  const podeExcluir = authUser && pode(authUser, 'roteirizacao', 'excluir');
  const removeRoute = useRoutesStore((s) => s.removeRoute);
  const municipalities = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const getGarageById = useGaragesStore((s) => s.getGarageById);
  const schools = useSchoolsStore((s) => s.getSchools)();
  const studentsList = useStudentsStore((s) => s.getStudents)();

  const studentsCountByRouteId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of studentsList) {
      if (s.routeId) {
        map.set(s.routeId, (map.get(s.routeId) ?? 0) + 1);
      }
    }
    return map;
  }, [studentsList]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Route[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.routes
      .list(munFilter || undefined, { page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Route>(res)) {
          setItems(res.data);
          setTotal(res.total);
        } else {
          setItems(Array.isArray(res) ? (res as Route[]) : []);
          setTotal(Array.isArray(res) ? (res as Route[]).length : 0);
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
      await removeRoute(deleteTarget.id);
      toast.success('Rota excluída.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/roteirizacao');
    } catch {
      toast.error('Erro ao excluir rota.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalities.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((r) => municipalityIdsByState.has(r.municipalityId));
    }
    if (munFilter) list = list.filter((r) => r.municipalityId === munFilter);
    if (schoolFilter) list = list.filter((r) => r.schoolId === schoolFilter);
    if (shiftFilter) list = list.filter((r) => matchesShiftFilter(r.shift, shiftFilter));
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [items, search, stateFilter, munFilter, schoolFilter, shiftFilter, statusFilter, municipalities]);

  const stateOptions = useMemo(
    () => Array.from(new Set(municipalities.map((m) => m.state))).sort(),
    [municipalities]
  );

  const municipalityOptions = useMemo(() => {
    const list = stateFilter
      ? municipalities.filter((m) => m.state === stateFilter)
      : municipalities;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [municipalities, stateFilter]);

  const schoolOptions = useMemo(() => {
    let list = schools;
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalities.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((s) => municipalityIdsByState.has(s.municipalityId));
    }
    if (munFilter) list = list.filter((s) => s.municipalityId === munFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [schools, municipalities, stateFilter, munFilter]);

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunFilter('');
    setSchoolFilter('');
    setShiftFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageRoutes = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Rotas</h2>
        {podeCriar && (
          <Link
            to="/roteirizacao/nova"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Nova Rota
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome da rota..."
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
            setSchoolFilter('');
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
            setSchoolFilter('');
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os municípios</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={schoolFilter}
          onChange={(e) => {
            setSchoolFilter(e.target.value);
            setPage(1);
          }}
          className="min-w-[220px] px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todas as Escolas</option>
          {schoolOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={shiftFilter}
          onChange={(e) => {
            setShiftFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os turnos</option>
          <option value="morning">Manhã</option>
          <option value="afternoon">Tarde</option>
          <option value="integral">Integral</option>
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
          <option value="active">Ativa</option>
          <option value="inactive">Inativa</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluída</option>
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
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="text-left text-urban-gray-data border-b border-urban-petrol/30 bg-white/5">
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3 min-w-[140px]">Escola destino</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3 w-20 whitespace-nowrap">Alunos</th>
                <th className="px-4 py-3 min-w-[120px]">Garagem origem</th>
                <th className="px-4 py-3">Paradas</th>
                <th className="px-4 py-3">Distância</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageRoutes.map((r) => {
                const mun = municipalities.find((m) => m.id === r.municipalityId);
                const school = schools.find((sc) => sc.id === r.schoolId);
                const linkedStudents = studentsCountByRouteId.get(r.id) ?? 0;
                const studentCount = Math.max(r.totalStudents ?? 0, linkedStudents);
                const garage = r.garageId ? getGarageById(r.garageId) : undefined;
                const studentsTitle =
                  studentCount === 1
                    ? '1 aluno vinculado à rota no cadastro'
                    : studentCount > 0
                      ? `${studentCount} alunos vinculados à rota no cadastro`
                      : 'Nenhum aluno vinculado à rota';
                const studentsDisplay = String(studentCount);
                return (
                  <tr key={r.id} className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">{mun?.name ?? '-'}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {school ? (
                        <Link to={`/escolas/${school.id}`} className="text-urban-green hover:underline truncate block" title={school.name}>
                          {school.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">{shiftLabel(r.shift)}</td>
                    <td className="px-4 py-3 tabular-nums" title={studentsTitle}>
                      {studentsDisplay}
                    </td>
                    <td className="px-4 py-3">{garage?.name ?? '—'}</td>
                    <td className="px-4 py-3">{r.totalStops}</td>
                    <td className="px-4 py-3">{r.estimatedKm} km</td>
                    <td className="px-4 py-3">{formatDuration(r.estimatedDuration)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status] ?? ''}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/roteirizacao/${r.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditar && (
                          <Link to={`/roteirizacao/${r.id}/editar`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluir && (
                          <button type="button" onClick={() => setDeleteTarget({ id: r.id, name: r.name })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
          <div className="px-4 py-8 text-center text-urban-gray-data">
            Nenhuma rota encontrada.
          </div>
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
        title={deleteTarget ? `Excluir a rota "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}
