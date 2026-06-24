import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Pencil, Eye, KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useScopedMunicipalityIds } from '@/hooks/useScopedMunicipalityIds';
import { isPaginated, TABLE_PAGE_SIZE, tablePaginationSummary } from '@/utils/pagination';
import { useAuthStore } from '@/store/authStore';
import { gestorPodeGerenciarLinhaUsuario, isAdminRole, pode } from '@/utils/permissoes';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';

const PERFIL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
};

const STATUS_LABEL: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  BLOQUEADO: 'Bloqueado',
};

const SETOR_LABEL: Record<string, string> = {
  SETOR_TRANSPORTE: 'Setor de transporte',
  SETOR_MAPAS: 'Setor de mapas',
  SETOR_EDUCACAO: 'Setor de educação',
};

export interface UsuarioRow {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string;
  login: string;
  perfil: string;
  status: string;
  ufAtuacao?: string | null;
  municipioIds?: string[];
  setorUnidade?: string | null;
  ultimoAcessoEm?: string | null;
  municipios?: Array<{ id: string; name: string; state: string }>;
  criadoPorUsuarioId?: string | null;
}

export function UsuariosList() {
  const user = useAuthStore((s) => s.user);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const scopedMunIds = useScopedMunicipalityIds();
  const munOptions = useMemo(() => {
    if (scopedMunIds === null) return municipalitiesList;
    return municipalitiesList.filter((m) => scopedMunIds.includes(m.id));
  }, [municipalitiesList, scopedMunIds]);
  const podeCriar = user && pode(user, 'usuarios', 'criar');
  const podeEditar = user && pode(user, 'usuarios', 'editar');
  const podeExcluirModulo = user && pode(user, 'usuarios', 'excluir');
  const [deleteTarget, setDeleteTarget] = useState<UsuarioRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetSenhaTarget, setResetSenhaTarget] = useState<UsuarioRow | null>(null);
  const [resetSenhaLoading, setResetSenhaLoading] = useState(false);
  const [items, setItems] = useState<UsuarioRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [munFilter, setMunFilter] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [setorFilter, setSetorFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.usuarios
      .list({
        q: q.trim() || undefined,
        municipioId: munFilter || undefined,
        perfil: perfilFilter || undefined,
        status: statusFilter || undefined,
        setor: setorFilter || undefined,
        page,
        pageSize: TABLE_PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;
        if (isPaginated<UsuarioRow>(res)) {
          setItems(res.data as UsuarioRow[]);
          setTotal(res.total);
        } else {
          const arr = Array.isArray(res) ? (res as UsuarioRow[]) : [];
          setItems(arr);
          setTotal(arr.length);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          toast.error(e.message || 'Erro ao carregar usuários');
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, munFilter, perfilFilter, statusFilter, setorFilter, page]);

  const excluirUsuario = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.usuarios.remove(deleteTarget.id);
      toast.success('Usuário excluído.');
      setDeleteTarget(null);
      setItems((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir usuário');
    } finally {
      setDeleteLoading(false);
    }
  };

  const executarResetSenha = async () => {
    if (!resetSenhaTarget) return;
    setResetSenhaLoading(true);
    try {
      const res = await api.usuarios.resetSenha(resetSenhaTarget.id);
      if (res.temporaryPassword) {
        toast.success('Senha temporária copiável no console (mensagem única).');
        // eslint-disable-next-line no-console
        console.info('Senha temporária:', res.temporaryPassword);
        await navigator.clipboard.writeText(res.temporaryPassword);
        toast.success('Senha copiada para a área de transferência');
      } else {
        toast.success(res.message ?? 'Senha redefinida');
      }
      setResetSenhaTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao redefinir senha');
    } finally {
      setResetSenhaLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-urban-gray-light">Usuários</h1>
          <p className="text-sm text-urban-gray-data mt-1">Cadastro e gestão de acesso ao sistema</p>
        </div>
        {podeCriar && (
          <Link
            to="/usuarios/novo"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-urban-green text-white font-medium hover:brightness-110 transition-all"
          >
            <Plus size={20} />
            Novo usuário
          </Link>
        )}
      </div>

      <div className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-urban-gray-data" size={18} />
            <input
              type="search"
              placeholder="Buscar nome, login, e-mail ou CPF..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light placeholder:text-urban-gray-data/60"
            />
          </div>
          <select
            value={munFilter}
            onChange={(e) => {
              setMunFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light"
          >
            <option value="">Todos os municípios</option>
            {munOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={perfilFilter}
            onChange={(e) => {
              setPerfilFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light"
          >
            <option value="">Perfil</option>
            {isAdminRole(user?.role) && <option value="ADMIN">Administrador</option>}
            <option value="GESTOR">Gestor</option>
            <option value="OPERADOR">Operador</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light"
          >
            <option value="">Status</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
          <select
            value={setorFilter}
            onChange={(e) => {
              setSetorFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light"
          >
            <option value="">Setor</option>
            <option value="SETOR_TRANSPORTE">Transporte</option>
            <option value="SETOR_MAPAS">Mapas</option>
            <option value="SETOR_EDUCACAO">Educação</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-urban-petrol/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-urban-petrol/20 text-left text-urban-gray-data">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                <th className="px-4 py-3 font-medium">UF / Cidades / Setor</th>
                <th className="px-4 py-3 font-medium">Login / E-mail</th>
                <th className="px-4 py-3 font-medium">Último acesso</th>
                <th className="px-4 py-3 font-medium align-middle">Status</th>
                <th className="px-4 py-3 font-medium text-right align-middle">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-urban-gray-data">
                    Carregando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-urban-gray-data">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const linhaGestorOk = gestorPodeGerenciarLinhaUsuario(user, {
                    perfil: row.perfil,
                    criadoPorUsuarioId: row.criadoPorUsuarioId,
                  });
                  const podeAcoes = podeEditar && linhaGestorOk;
                  const podeExcluirLinha =
                    podeExcluirModulo &&
                    linhaGestorOk &&
                    user?.id !== row.id;
                  return (
                  <tr key={row.id} className="border-t border-urban-petrol/15 hover:bg-white/5">
                    <td className="px-4 py-3 text-urban-gray-light font-medium">{row.nomeCompleto}</td>
                    <td className="px-4 py-3">{PERFIL_LABEL[row.perfil] ?? row.perfil}</td>
                    <td className="px-4 py-3 text-urban-gray-data">
                      <div className="text-urban-gray-light">{row.ufAtuacao ?? '—'}</div>
                      <div className="text-xs">
                        {row.municipios?.length
                          ? row.municipios.map((m) => m.name).join(', ')
                          : '—'}
                      </div>
                      <div className="text-xs text-urban-gray-data/80">
                        {row.setorUnidade ? SETOR_LABEL[row.setorUnidade] ?? row.setorUnidade : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-urban-gray-light">{row.login}</div>
                      <div className="text-xs text-urban-gray-data/80">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-urban-gray-data text-xs">
                      {row.ultimoAcessoEm
                        ? new Date(row.ultimoAcessoEm).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === 'ATIVO'
                            ? 'bg-urban-green/20 text-urban-green'
                            : row.status === 'BLOQUEADO'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                        }`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex flex-wrap justify-end items-center gap-1">
                        <Link
                          to={`/usuarios/${row.id}`}
                          className="inline-flex p-1.5 rounded-lg text-urban-gray-data hover:bg-white/10"
                          title="Ver"
                        >
                          <Eye size={18} />
                        </Link>
                        {podeAcoes && (
                          <Link
                            to={`/usuarios/editar/${row.id}`}
                            className="inline-flex p-1.5 rounded-lg text-urban-green hover:bg-urban-green/10"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </Link>
                        )}
                        {podeExcluirLinha && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="inline-flex p-1.5 rounded-lg text-urban-gray-data hover:bg-red-500/20 hover:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        {podeAcoes && (
                          <button
                            type="button"
                            onClick={() => setResetSenhaTarget(row)}
                            className="inline-flex p-1.5 rounded-lg text-orange-400 hover:bg-orange-500/15 hover:text-orange-300"
                            title="Redefinir senha"
                          >
                            <KeyRound size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-urban-gray-data">
            <span>
              {tablePaginationSummary(items.length, page, totalPages, total)}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-urban-petrol/30 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-urban-petrol/30 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        open={deleteTarget != null}
        title={deleteTarget ? `Excluir ${deleteTarget.nomeCompleto}?` : 'Excluir usuário?'}
        description="O cadastro será removido permanentemente. Esta ação não poderá ser desfeita."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void excluirUsuario()}
        confirming={deleteLoading}
      />
      <DeleteConfirmModal
        open={resetSenhaTarget != null}
        title={
          resetSenhaTarget ? `Redefinir senha de ${resetSenhaTarget.nomeCompleto}?` : 'Redefinir senha?'
        }
        description="Uma nova senha temporária será gerada. Confirme apenas se deseja prosseguir."
        onCancel={() => setResetSenhaTarget(null)}
        onConfirm={() => void executarResetSenha()}
        confirming={resetSenhaLoading}
        confirmLabel="Redefinir senha"
        confirmingLabel="Redefinindo…"
        confirmButtonClassName="px-4 py-2 rounded-lg bg-orange-500/90 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
      />
    </div>
  );
}
