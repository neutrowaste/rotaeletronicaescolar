import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudentsStore } from '@/store/studentsStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useRoutesStore } from '@/store/routesStore';
import { api } from '@/services/api';
import type { Student } from '@rota-eletronica/shared-types';
import { matchesShiftFilter, shiftLabel } from '@rota-eletronica/shared-types';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StudentImportModal } from '@/components/students/StudentImportModal';
import { StudentCreateChoiceModal } from '@/components/students/StudentCreateChoiceModal';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole, pode } from '@/utils/permissoes';
import { buildStudentExportZipFilename } from '@/utils/studentExportFilename';
import {
  displayValueOrDash,
  getStudentIncompleteFieldSet,
  getStudentIncompleteMessages,
  incompleteListCellClass,
  INCOMPLETE_ALERT_ICON_CLASS,
  type StudentIncompleteField,
} from '@/utils/studentCompleteness';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  transferred: 'Transferido',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
  transferred: 'bg-amber-500/20 text-amber-400',
};

export function AlunosList() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeCriar = authUser && pode(authUser, 'alunos', 'criar');
  const podeEditar = authUser && pode(authUser, 'alunos', 'editar');
  const podeExcluir = authUser && pode(authUser, 'alunos', 'excluir');
  const podeExportar = authUser && isAdminRole(authUser.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const removeStudent = useStudentsStore((s) => s.removeStudent);
  const fetchStudentsStore = useStudentsStore((s) => s.fetchStudents);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const fetchMunicipalities = useMunicipalitiesStore((s) => s.fetchMunicipalities);
  const getRouteById = useRoutesStore((s) => s.getRouteById);
  const schoolsList = getSchools();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [items, setItems] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [munFilter, setMunFilter] = useState(() => searchParams.get('municipalityId') ?? '');
  const [schoolFilter, setSchoolFilter] = useState(() => searchParams.get('schoolId') ?? '');
  const [routeFilter, setRouteFilter] = useState(() => searchParams.get('routeId') ?? '');
  const [shiftFilter, setShiftFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => {
    const mid = searchParams.get('municipalityId') ?? '';
    const sid = searchParams.get('schoolId') ?? '';
    const rid = searchParams.get('routeId') ?? '';
    setMunFilter(mid);
    setSchoolFilter(sid);
    setRouteFilter(rid);
    setPage(1);
  }, [searchParams]);

  const filteredRouteName = routeFilter ? getRouteById(routeFilter)?.name : undefined;

  const clearRouteFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('routeId');
    setSearchParams(next);
  };

  useEffect(() => {
    if (municipalitiesList.length === 0) {
      void fetchMunicipalities({ silent: true });
    }
  }, [municipalitiesList.length, fetchMunicipalities]);

  const loadPage = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);
      try {
        const res = await api.students.list({
          municipalityId: munFilter || undefined,
          schoolId: schoolFilter || undefined,
          routeId: routeFilter || undefined,
          page: pageToLoad,
          pageSize: TABLE_PAGE_SIZE,
        });
        if (isPaginated<Student>(res)) {
          setItems(res.data);
          setTotal(res.total);
        } else {
          const list = Array.isArray(res) ? (res as Student[]) : [];
          setItems(list);
          setTotal(list.length);
        }
      } catch (err) {
        setItems([]);
        setTotal(0);
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar alunos.');
      } finally {
        setLoading(false);
      }
    },
    [munFilter, schoolFilter, routeFilter]
  );

  useEffect(() => {
    void loadPage(page);
  }, [page, loadPage]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeStudent(deleteTarget.id);
      toast.success('Aluno excluído.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      navigate('/alunos');
    } catch {
      toast.error('Erro ao excluir aluno.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const schoolsInMun = useMemo(
    () => {
      if (munFilter) return schoolsList.filter((s) => s.municipalityId === munFilter);
      if (stateFilter) {
        const municipalityIdsByState = new Set(
          municipalitiesList.filter((m) => m.state === stateFilter).map((m) => m.id)
        );
        return schoolsList.filter((s) => municipalityIdsByState.has(s.municipalityId));
      }
      return schoolsList;
    },
    [schoolsList, munFilter, stateFilter, municipalitiesList]
  );

  const municipalityOptions = useMemo(() => {
    const list = stateFilter
      ? municipalitiesList.filter((m) => m.state === stateFilter)
      : municipalitiesList;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [municipalitiesList, stateFilter]);

  const stateOptions = useMemo(
    () => Array.from(new Set(municipalitiesList.map((m) => m.state))).sort(),
    [municipalitiesList]
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.students.exportZip();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildStudentExportZipFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída. O arquivo foi baixado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar alunos.');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStateFilter('');
    setMunFilter('');
    setSchoolFilter('');
    setShiftFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.registrationNumber ?? '').toLowerCase().includes(q)
      );
    }
    if (shiftFilter) list = list.filter((s) => matchesShiftFilter(s.shift, shiftFilter));
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [items, search, shiftFilter, statusFilter]);

  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE) || 1;
  const pageStudents = filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-urban-gray-light">Alunos</h2>
        <div className="flex flex-wrap items-center gap-2">
          {podeExportar && (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {exporting ? 'Exportando...' : 'Exportar alunos'}
            </button>
          )}
          {podeCriar && (
            <button
              type="button"
              onClick={() => setCreateChoiceOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
            >
              <Plus size={18} /> Novo Aluno
            </button>
          )}
        </div>
      </div>

      {routeFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-urban-green/40 bg-urban-green/10 px-3 py-2 text-sm">
          <span className="text-urban-gray-light">
            Filtrando alunos da rota:{' '}
            <strong className="text-urban-green">{filteredRouteName ?? routeFilter}</strong>
          </span>
          <button
            type="button"
            onClick={clearRouteFilter}
            className="text-urban-green hover:underline font-medium ml-auto"
          >
            Limpar filtro da rota
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou matrícula..."
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
          className="px-4 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light focus:outline-none focus:ring-2 focus:ring-urban-green"
        >
          <option value="">Todas as escolas</option>
          {schoolsInMun.map((s) => (
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
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="transferred">Transferido</option>
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
        {loading && (
          <div className="px-4 py-8 text-center text-urban-gray-data">Carregando...</div>
        )}
        {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-urban-gray-data border-b border-urban-petrol/30 bg-white/5">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Série</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3">Município</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageStudents.map((s) => {
                const mun = municipalitiesList.find((m) => m.id === s.municipalityId);
                const school = schoolsList.find((sc) => sc.id === s.schoolId);
                const alertIssues = getStudentIncompleteMessages(s);
                const incompleteFields = getStudentIncompleteFieldSet(s);
                const showCadastroAlert = alertIssues.length > 0;
                const alertTitle = alertIssues.join(' · ');
                const cellClass = (field: StudentIncompleteField) =>
                  incompleteListCellClass(field, incompleteFields);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-urban-petrol/20 text-urban-gray-light hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        {showCadastroAlert && (
                          <span className="flex-shrink-0 inline-flex cursor-help" title={alertTitle}>
                            <AlertTriangle
                              className={INCOMPLETE_ALERT_ICON_CLASS}
                              size={18}
                              strokeWidth={2}
                              aria-label={`Cadastro a revisar: ${alertTitle}`}
                            />
                          </span>
                        )}
                        <span className={`truncate min-w-0 flex-1 ${cellClass('name')}`}>
                          {displayValueOrDash(s.name)}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${cellClass('registrationNumber')}`}>
                      {displayValueOrDash(s.registrationNumber)}
                    </td>
                    <td className={`px-4 py-3 ${cellClass('grade')}`}>{displayValueOrDash(s.grade)}</td>
                    <td className="px-4 py-3">{shiftLabel(s.shift)}</td>
                    <td className={`px-4 py-3 ${cellClass('schoolId')}`}>{displayValueOrDash(school?.name)}</td>
                    <td className={`px-4 py-3 ${cellClass('municipalityId')}`}>{displayValueOrDash(mun?.name)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[s.status] ?? ''}`}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/alunos/${s.id}`} className="text-urban-green hover:underline">Ver</Link>
                        {podeEditar && (
                          <Link to={`/alunos/editar/${s.id}`} className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-green" title="Editar"><Pencil size={14} /></Link>
                        )}
                        {podeExcluir && (
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
          <div className="px-4 py-8 text-center text-urban-gray-data">Nenhum aluno encontrado.</div>
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
        title={deleteTarget ? `Excluir o aluno "${deleteTarget.name}"?` : ''}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleteLoading}
      />

      <StudentCreateChoiceModal
        open={createChoiceOpen}
        onClose={() => setCreateChoiceOpen(false)}
        onManualCreate={() => {
          setCreateChoiceOpen(false);
          navigate('/alunos/novo');
        }}
        onBatchImport={() => {
          setCreateChoiceOpen(false);
          setImportOpen(true);
        }}
      />

      <StudentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={async () => {
          toast.success('Importação concluída.');
          await fetchStudentsStore(
            {
              municipalityId: munFilter || undefined,
              schoolId: schoolFilter || undefined,
            },
            { silent: true }
          );
          await loadPage(page);
        }}
      />
    </div>
  );
}
