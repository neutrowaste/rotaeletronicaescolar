import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { api } from '@/services/api';
import type { Garage } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';
export function GaragensList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'garagens', 'criar');
  const podeEditar = authUser && pode(authUser, 'garagens', 'editar');
  const podeExcluir = authUser && pode(authUser, 'garagens', 'excluir');
  const removeGarage = useGaragesStore((s) => s.removeGarage);
  const setGaragesItems = useGaragesStore((s) => s.setItems);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const vehiclesList = useVehiclesStore((s) => s.getVehicles)();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Garage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.garages
      .list(munFilter || undefined, { page, pageSize: TABLE_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<Garage>(res)) {
          setItems(res.data);
          setTotal(res.total);
          setGaragesItems(res.data);
        } else {
          setItems(Array.isArray(res) ? (res as Garage[]) : []);
          setTotal(Array.isArray(res) ? (res as Garage[]).length : 0);
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
  }, [page, munFilter, setGaragesItems]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeGarage(deleteTarget.id);
      toast.success('Garagem excluída.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/garagens');
    } catch {
      toast.error('Erro ao excluir garagem.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.address.toLowerCase().includes(q)
      );
    }
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((g) => municipalityIdsByState.has(g.municipalityId));
    }
    if (munFilter) list = list.filter((g) => g.municipalityId === munFilter);
    if (nameFilter) list = list.filter((g) => g.id === nameFilter);
    return list;
  }, [items, search, stateFilter, munFilter, nameFilter, municipalitiesList]);

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

  const nameOptions = useMemo(() => {
    let list = items;
    if (stateFilter) {
      const municipalityIdsByState = new Set(
        municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
      );
      list = list.filter((g) => municipalityIdsByState.has(g.municipalityId));
    }
    if (munFilter) list = list.filter((g) => g.municipalityId === munFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, municipalitiesList, stateFilter, munFilter]);

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunFilter('');
    setNameFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageItems = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Garagens</h2>
        {podeCriar && (
          <Link
            to="/garagens/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            <Plus size={18} /> Nova Garagem
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou endereço..."
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
            setNameFilter('');
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
            setNameFilter('');
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
          value={nameFilter}
          onChange={(e) => {
            setNameFilter(e.target.value);
            setPage(1);
          }}
          className="min-w-[220px] px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todos os nomes</option>
          {nameOptions.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
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
                <th className="px-4 py-3">Endereço</th>
                <th className="px-4 py-3">Veículos vinculados</th>
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3">Coordenadas</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((g) => {
                const mun = municipalitiesList.find((m) => m.id === g.municipalityId);
                const vehiclesCount = vehiclesList.filter((v) => v.garageId === g.id).length;
                return (
                  <tr key={g.id} className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3">{g.address}</td>
                    <td className="px-4 py-3">{vehiclesCount}</td>
                    <td className="px-4 py-3">{mun?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-urban-gray-data text-xs">
                      {g.coordinates.lat.toFixed(4)}, {g.coordinates.lng.toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/garagens/${g.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditar && (
                          <Link to={`/garagens/editar/${g.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluir && (
                          <button type="button" onClick={() => setDeleteTarget({ id: g.id, name: g.name })} className="p-1.5 rounded hover:bg-red-500/20 text-urban-gray-data hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhuma garagem encontrada.</div>
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
            >Anterior</button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light disabled:opacity-50 disabled:cursor-not-allowed"
            >Próxima</button>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Excluir a garagem "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />
    </div>
  );
}
