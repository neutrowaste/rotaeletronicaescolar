import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useStudentsStore } from '@/store/studentsStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useRoutesStore } from '@/store/routesStore';
import { getContractExpiryWarning, CONTRACT_EXPIRY_CLASS } from '@/utils/contractExpiry';
import { getMunicipalityCounts } from '@/utils/municipalityCounts';
import { api } from '@/services/api';
import type { Municipality } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
};

export function MunicipiosList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'municipios', 'criar');
  const podeEditar = authUser && pode(authUser, 'municipios', 'editar');
  const podeExcluir = authUser && pode(authUser, 'municipios', 'excluir');
  const removeMunicipality = useMunicipalitiesStore((s) => s.removeMunicipality);
  const setMunicipalitiesItems = useMunicipalitiesStore((s) => s.setItems);
  const getStudents = useStudentsStore((s) => s.getStudents);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const students = getStudents();
  const schools = getSchools();
  const vehicles = getVehicles();
  const routes = getRoutes();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Municipality[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [municipalityFilter, setMunicipalityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.municipalities
      .list({ page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Municipality>(res)) {
          setItems(res.data);
          setTotal(res.total);
          setMunicipalitiesItems(res.data);
        } else {
          setItems(Array.isArray(res) ? (res as Municipality[]) : []);
          setTotal(Array.isArray(res) ? (res as Municipality[]).length : 0);
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
  }, [page, setMunicipalitiesItems]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeMunicipality(deleteTarget.id);
      toast.success('Município excluído.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/municipios');
    } catch {
      toast.error('Erro ao excluir município.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.responsible.toLowerCase().includes(q) ||
          m.ibgeCode.includes(q)
      );
    }
    if (stateFilter) list = list.filter((m) => m.state === stateFilter);
    if (municipalityFilter) list = list.filter((m) => m.id === municipalityFilter);
    if (statusFilter) list = list.filter((m) => m.status === statusFilter);
    return list;
  }, [items, search, stateFilter, municipalityFilter, statusFilter]);

  const stateOptions = useMemo(
    () => Array.from(new Set(items.map((m) => m.state))).sort(),
    [items]
  );

  const municipalityOptions = useMemo(() => {
    const list = stateFilter ? items.filter((m) => m.state === stateFilter) : items;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, stateFilter]);

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunicipalityFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageItems = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Municípios</h2>
        {podeCriar && (
          <Link
            to="/municipios/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Novo Município
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, responsável ou código IBGE..."
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
            setMunicipalityFilter('');
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
          value={municipalityFilter}
          onChange={(e) => {
            setMunicipalityFilter(e.target.value);
            setPage(1);
          }}
          className="min-w-[220px] px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os municípios</option>
          {municipalityOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
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
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3">UF</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Escolas</th>
                <th className="px-4 py-3">Alunos</th>
                <th className="px-4 py-3">Veículos</th>
                <th className="px-4 py-3">Rotas</th>
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3">Alerta</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => {
                const expiryWarning = getContractExpiryWarning(m.contractEnd);
                const counts = getMunicipalityCounts(m.id, students, schools, vehicles, routes);
                return (
                <tr
                  key={m.id}
                  className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5"
                >
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">{m.state}</td>
                  <td className="px-4 py-3">{m.responsible}</td>
                  <td className="px-4 py-3">{counts.totalSchools}</td>
                  <td className="px-4 py-3">{counts.totalStudents}</td>
                  <td className="px-4 py-3">{counts.totalVehicles}</td>
                  <td className="px-4 py-3">{counts.totalRoutes}</td>
                  <td className="px-4 py-3 text-urban-gray-data text-xs">
                    {formatDate(m.contractStart)} — {formatDate(m.contractEnd)}
                  </td>
                  <td className="px-4 py-3">
                    {expiryWarning && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_EXPIRY_CLASS[expiryWarning.severity]}`}
                        title={`Contrato ${expiryWarning.label.toLowerCase()}`}
                      >
                        <AlertTriangle size={12} />
                        {expiryWarning.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[m.status] ?? ''}`}
                    >
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/municipios/${m.id}`} className="text-urban-green hover:underline">Ver</Link>
                      {podeEditar && (
                        <Link to={`/municipios/editar/${m.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                      )}
                      {podeExcluir && (
                        <button type="button" onClick={() => setDeleteTarget({ id: m.id, name: m.name })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhum município encontrado.</div>
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
        title={deleteTarget ? `Excluir o município "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}
