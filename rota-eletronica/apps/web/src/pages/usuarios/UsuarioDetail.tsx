import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { maskCpf, maskPhone } from '@rota-eletronica/shared-utils';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { gestorPodeGerenciarLinhaUsuario, pode } from '@/utils/permissoes';
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

export function UsuarioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [excluirLoading, setExcluirLoading] = useState(false);
  const [resetSenhaAberto, setResetSenhaAberto] = useState(false);
  const [resetSenhaLoading, setResetSenhaLoading] = useState(false);

  const linhaGestorOk =
    user &&
    row &&
    gestorPodeGerenciarLinhaUsuario(user, {
      perfil: String(row.perfil),
      criadoPorUsuarioId: row.criadoPorUsuarioId as string | null | undefined,
    });

  const podeGerenciar =
    user && row && pode(user, 'usuarios', 'editar') && linhaGestorOk;

  const podeExcluir =
    user &&
    row &&
    id &&
    pode(user, 'usuarios', 'excluir') &&
    linhaGestorOk &&
    user.id !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.usuarios
      .get(id)
      .then((r) => {
        if (!cancelled) setRow(r);
      })
      .catch((e: Error) => {
        toast.error(e.message);
        navigate('/usuarios');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const patchStatus = async (status: string) => {
    if (!id) return;
    try {
      const updated = await api.usuarios.patchStatus(id, status);
      setRow(updated as Record<string, unknown>);
      toast.success('Status atualizado');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const excluirUsuario = async () => {
    if (!id) return;
    setExcluirLoading(true);
    try {
      await api.usuarios.remove(id);
      toast.success('Usuário excluído.');
      setExcluirAberto(false);
      navigate('/usuarios');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir usuário');
    } finally {
      setExcluirLoading(false);
    }
  };

  const executarResetSenha = async () => {
    if (!id || !row) return;
    setResetSenhaLoading(true);
    try {
      const res = await api.usuarios.resetSenha(id);
      if (res.temporaryPassword) {
        await navigator.clipboard.writeText(res.temporaryPassword);
        toast.success('Senha temporária copiada para a área de transferência');
      } else {
        toast.success(res.message ?? 'Senha redefinida');
      }
      setResetSenhaAberto(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setResetSenhaLoading(false);
    }
  };

  if (loading || !row) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh] text-urban-gray-data">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col space-y-4 w-full max-w-none">
      <Link
        to="/usuarios"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green w-fit"
      >
        <ArrowLeft size={16} />
        Voltar à listagem
      </Link>

      {(podeGerenciar || podeExcluir) && (
        <div className="flex flex-wrap items-center gap-2">
          {podeGerenciar && (
            <Link
              to={`/usuarios/editar/${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
            >
              <Pencil size={14} />
              Editar
            </Link>
          )}
          {podeExcluir && (
            <button
              type="button"
              onClick={() => setExcluirAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
            >
              <Trash2 size={14} />
              Excluir
            </button>
          )}
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setResetSenhaAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/45 text-orange-400 hover:bg-orange-500/15 hover:text-orange-300 text-sm font-medium"
            >
              <KeyRound size={14} />
              Redefinir senha
            </button>
          )}
        </div>
      )}

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-urban-gray-light">{String(row.nomeCompleto)}</h1>
            <p className="text-sm text-urban-gray-data mt-0.5">
              {PERFIL_LABEL[String(row.perfil)] ?? String(row.perfil)} •{' '}
              {STATUS_LABEL[String(row.status)] ?? String(row.status)}
            </p>
          </div>
        </div>

        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">CPF</p>
            <p className="text-urban-gray-light text-sm font-medium">{maskCpf(String(row.cpf ?? ''))}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Telefone</p>
            <p className="text-urban-gray-light text-sm font-medium">{maskPhone(String(row.telefone ?? ''))}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 sm:col-span-2 lg:col-span-1">
            <p className="text-urban-gray-data text-xs mb-1">E-mail</p>
            <p className="text-urban-gray-light text-sm font-medium break-all">{String(row.email)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Login</p>
            <p className="text-urban-gray-light text-sm font-medium">{String(row.login)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Perfil</p>
            <p className="text-urban-gray-light text-sm font-medium">{PERFIL_LABEL[String(row.perfil)] ?? String(row.perfil)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Status</p>
            <p className="text-urban-gray-light text-sm font-medium">{STATUS_LABEL[String(row.status)] ?? String(row.status)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 sm:col-span-2">
            <p className="text-urban-gray-data text-xs mb-1">UF e cidades de atuação</p>
            <p className="text-urban-gray-light text-sm font-medium">
              {row.ufAtuacao ? String(row.ufAtuacao) : '—'}
            </p>
            <p className="text-urban-gray-data text-xs mt-1">
              {Array.isArray(row.municipios) && row.municipios.length > 0
                ? (row.municipios as { name: string }[]).map((m) => m.name).join(', ')
                : 'Nenhuma cidade vinculada'}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Unidade (setor)</p>
            <p className="text-urban-gray-light text-sm font-medium">
              {row.setorUnidade ? SETOR_LABEL[String(row.setorUnidade)] ?? String(row.setorUnidade) : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Último acesso</p>
            <p className="text-urban-gray-light text-sm font-medium">
              {row.ultimoAcessoEm
                ? new Date(String(row.ultimoAcessoEm)).toLocaleString('pt-BR')
                : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Deve trocar senha</p>
            <p className="text-urban-gray-light text-sm font-medium">{row.deveTrocarSenha ? 'Sim' : 'Não'}</p>
          </div>
        </div>

        {podeGerenciar && (
          <div className="p-4 border-t border-urban-petrol/30 bg-white/5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-urban-gray-data mr-1">Alterar status:</span>
            <button
              type="button"
              onClick={() => patchStatus('ATIVO')}
              className="px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green text-sm font-medium hover:bg-urban-green/30"
            >
              Ativo
            </button>
            <button
              type="button"
              onClick={() => patchStatus('INATIVO')}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-sm font-semibold hover:bg-yellow-500/22 hover:border-yellow-400/40"
            >
              Inativo
            </button>
            <button
              type="button"
              onClick={() => patchStatus('BLOQUEADO')}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30"
            >
              Bloqueado
            </button>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={row ? `Excluir ${String(row.nomeCompleto)}?` : 'Excluir usuário?'}
        description="O cadastro será removido permanentemente. Esta ação não poderá ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={() => void excluirUsuario()}
        confirming={excluirLoading}
      />
      <DeleteConfirmModal
        open={resetSenhaAberto}
        title="Redefinir senha deste usuário?"
        description="Uma nova senha temporária será gerada. Confirme apenas se deseja prosseguir."
        onCancel={() => setResetSenhaAberto(false)}
        onConfirm={() => void executarResetSenha()}
        confirming={resetSenhaLoading}
        confirmLabel="Redefinir senha"
        confirmingLabel="Redefinindo…"
        confirmButtonClassName="px-4 py-2 rounded-lg bg-orange-500/90 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
      />
    </div>
  );
}
