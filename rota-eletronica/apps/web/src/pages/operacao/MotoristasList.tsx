import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDriversStore } from '@/store/driversStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { api } from '@/services/api';
import type { Driver } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';
import {
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

export function MotoristasList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'motoristas', 'criar');
  const podeEditar = authUser && pode(authUser, 'motoristas', 'editar');
  const podeExcluir = authUser && pode(authUser, 'motoristas', 'excluir');
  const removeDriver = useDriversStore((s) => s.removeDriver);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const fetchMunicipalities = useMunicipalitiesStore((s) => s.fetchMunicipalities);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (municipalitiesList.length === 0) {
      void fetchMunicipalities({ silent: true });
    }
  }, [municipalitiesList.length, fetchMunicipalities]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.drivers
      .list(munFilter || undefined, { page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Driver>(res)) {
          setItems(res.data);
          setTotal(res.total);
        } else {
          const list = Array.isArray(res) ? (res as Driver[]) : [];
          setItems(list);
          setTotal(list.length);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          toast.error(err instanceof Error ? err.message : 'Erro ao carregar motoristas.');
        }
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
      await removeDriver(deleteTarget.id);
      toast.success('Motorista excluído.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/operacao/motoristas');
    } catch {
      toast.error('Erro ao excluir motorista.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.cpf.includes(q) ||
          (d.employeeId && d.employeeId.toLowerCase().includes(q))
      );
    }
    if (stateFilter && municipalitiesList.length > 0) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      if (municipalityIdsByState.size === 0) {
        list = [];
      } else {
        list = list.filter((d) =>
          (d.municipalityIds ?? []).some((mid) => municipalityIdsByState.has(mid))
        );
      }
    }
    if (munFilter && !stateFilter) {
      list = list.filter((d) => (d.municipalityIds ?? []).includes(munFilter));
    }
    if (statusFilter) list = list.filter((d) => d.status === statusFilter);
    return list;
  }, [items, search, stateFilter, munFilter, statusFilter, municipalitiesList]);

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
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageItems = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Motoristas</h2>
        {podeCriar && (
          <Link
            to="/operacao/motoristas/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Novo Motorista
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou ID funcionário..."
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
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">ID Func.</th>
                <th className="px-4 py-3">Municípios de atuação</th>
                <th className="px-4 py-3">Categoria CNH</th>
                <th className="px-4 py-3">Venc. CNH</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => {
                const munNames = (d.municipalityIds ?? [])
                  .map((mid) => municipalitiesList.find((m) => m.id === mid)?.name)
                  .filter(Boolean)
                  .join(', ') || '-';
                const cnhWarning = getCnhExpiryWarning(d.licenseExpiry, d.status);
                const cnhAlertTitle = cnhWarning
                  ? `${cnhWarning.label} (vencimento: ${formatDate(d.licenseExpiry)})`
                  : '';
                return (
                  <tr key={d.id} className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        {cnhWarning && (
                          <span className="flex-shrink-0 inline-flex cursor-help" title={cnhAlertTitle}>
                            <AlertTriangle
                              className={CNH_EXPIRY_ICON_CLASS[cnhWarning.severity]}
                              size={18}
                              strokeWidth={2}
                              aria-label={cnhAlertTitle}
                            />
                          </span>
                        )}
                        <span className="truncate min-w-0 flex-1">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{d.cpf}</td>
                    <td className="px-4 py-3">{d.employeeId}</td>
                    <td className="px-4 py-3 text-urban-gray-data max-w-[180px] truncate" title={munNames}>{munNames}</td>
                    <td className="px-4 py-3">{d.licenseCategory}</td>
                    <td
                      className={`px-4 py-3 ${
                        cnhWarning ? CNH_EXPIRY_VALUE_CLASS[cnhWarning.severity] : ''
                      }`}
                    >
                      {formatDate(d.licenseExpiry)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[d.status] ?? ''}`}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/operacao/motoristas/${d.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditar && (
                          <Link to={`/operacao/motoristas/editar/${d.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluir && (
                          <button type="button" onClick={() => setDeleteTarget({ id: d.id, name: d.name })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhum motorista encontrado.</div>
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
        title={deleteTarget ? `Excluir o motorista "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}
