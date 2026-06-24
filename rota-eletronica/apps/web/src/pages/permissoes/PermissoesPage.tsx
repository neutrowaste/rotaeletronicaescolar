import { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, Save, Loader2, Check, Pencil, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ACAO_PERMISSAO_VALUES,
  MODULO_PERMISSAO_VALUES,
  MODULO_PERMISSAO_LABELS,
  ACAO_PERMISSAO_LABELS,
  type ModuloPermissao,
  type AcaoPermissao,
  type PermissoesUsuario,
} from '@rota-eletronica/shared-types';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole, pode } from '@/utils/permissoes';

type Matrix = Record<string, Record<string, boolean>>;

const SETORES = ['SETOR_TRANSPORTE', 'SETOR_MAPAS', 'SETOR_EDUCACAO'] as const;

const SETOR_LABEL: Record<string, string> = {
  SETOR_TRANSPORTE: 'Setor de transporte',
  SETOR_MAPAS: 'Setor de mapas',
  SETOR_EDUCACAO: 'Setor de educação',
};

function modulosParaAlvo(perfil: 'GESTOR' | 'OPERADOR'): ModuloPermissao[] {
  const all = [...MODULO_PERMISSAO_VALUES];
  if (perfil === 'OPERADOR') return all.filter((m) => m !== 'usuarios');
  return all;
}

function matrixFromPermissoesApi(perm: unknown, modulos: ModuloPermissao[], acessoTotal: boolean): Matrix {
  const m: Matrix = {};
  for (const mod of modulos) {
    m[mod] = {};
    for (const ac of ACAO_PERMISSAO_VALUES) {
      if (acessoTotal) {
        m[mod]![ac] = true;
      } else if (perm && typeof perm === 'object' && !Array.isArray(perm)) {
        const row = (perm as PermissoesUsuario)[mod];
        m[mod]![ac] = row?.[ac] === true;
      } else {
        m[mod]![ac] = false;
      }
    }
  }
  return m;
}

function matrixToPayload(matrix: Matrix, modulos: ModuloPermissao[]): PermissoesUsuario {
  const out: PermissoesUsuario = {};
  for (const mod of modulos) {
    const row = matrix[mod];
    if (!row) continue;
    const part: Partial<Record<AcaoPermissao, boolean>> = {};
    for (const ac of ACAO_PERMISSAO_VALUES) {
      if (row[ac]) part[ac] = true;
      else part[ac] = false;
    }
    out[mod] = part as Required<typeof part>;
  }
  return out;
}

function isNestedBySetor(perm: unknown): boolean {
  if (!perm || typeof perm !== 'object' || Array.isArray(perm)) return false;
  const o = perm as Record<string, unknown>;
  return SETORES.some((s) => Object.prototype.hasOwnProperty.call(o, s));
}

export type BlocoPerfilState = {
  acessoTotal: boolean;
  /** Matriz por setor de unidade */
  porSetor: Record<(typeof SETORES)[number], Matrix>;
};

function estadoInicialBloco(perfil: 'GESTOR' | 'OPERADOR', acessoTotal: boolean): BlocoPerfilState {
  const modulos = modulosParaAlvo(perfil);
  const porSetor = {} as BlocoPerfilState['porSetor'];
  for (const s of SETORES) {
    porSetor[s] = matrixFromPermissoesApi(null, modulos, acessoTotal);
  }
  return { acessoTotal, porSetor };
}

function permissoesApiParaBloco(perm: unknown, perfil: 'GESTOR' | 'OPERADOR'): BlocoPerfilState {
  const modulos = modulosParaAlvo(perfil);
  if (perm == null) {
    return estadoInicialBloco(perfil, true);
  }
  if (typeof perm === 'object' && perm && !Array.isArray(perm)) {
    if (isNestedBySetor(perm)) {
      const p = perm as Record<string, unknown>;
      const porSetor = {} as BlocoPerfilState['porSetor'];
      for (const s of SETORES) {
        porSetor[s] = matrixFromPermissoesApi(p[s], modulos, false);
      }
      return { acessoTotal: false, porSetor };
    }
    const porSetor = {} as BlocoPerfilState['porSetor'];
    for (const s of SETORES) {
      porSetor[s] = matrixFromPermissoesApi(perm, modulos, false);
    }
    return { acessoTotal: false, porSetor };
  }
  return estadoInicialBloco(perfil, true);
}

function blocoParaPayload(bloco: BlocoPerfilState, perfil: 'GESTOR' | 'OPERADOR'): unknown {
  if (bloco.acessoTotal) return null;
  const modulos = modulosParaAlvo(perfil);
  const out: Record<string, PermissoesUsuario> = {};
  for (const s of SETORES) {
    out[s] = matrixToPayload(bloco.porSetor[s], modulos);
  }
  return out;
}

export function PermissoesPage() {
  const user = useAuthStore((s) => s.user);
  const syncSessionFromApi = useAuthStore((s) => s.syncSessionFromApi);
  const canEdit = isAdminRole(user?.role);
  const podeEditarPermissoesPainel = user && pode(user, 'permissoes', 'editar');

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [gestor, setGestor] = useState<BlocoPerfilState>(() => estadoInicialBloco('GESTOR', true));
  const [operador, setOperador] = useState<BlocoPerfilState>(() => estadoInicialBloco('OPERADOR', true));
  const [saving, setSaving] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  /** Painéis por setor expansíveis (gestor / operador × 3 setores). */
  const [painelSetorAberto, setPainelSetorAberto] = useState<
    Record<'gestor' | 'operador', Record<(typeof SETORES)[number], boolean>>
  >(() => ({
    gestor: { SETOR_TRANSPORTE: false, SETOR_MAPAS: false, SETOR_EDUCACAO: false },
    operador: { SETOR_TRANSPORTE: false, SETOR_MAPAS: false, SETOR_EDUCACAO: false },
  }));

  const togglePainelSetor = (alvo: 'gestor' | 'operador', setor: (typeof SETORES)[number]) => {
    setPainelSetorAberto((prev) => ({
      ...prev,
      [alvo]: { ...prev[alvo], [setor]: !prev[alvo][setor] },
    }));
  };

  const modulosGestor = useMemo(() => modulosParaAlvo('GESTOR'), []);
  const modulosOperador = useMemo(() => modulosParaAlvo('OPERADOR'), []);

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingDetail(true);
    try {
      const [gRow, oRow] = await Promise.all([
        api.perfilPermissoes.get('GESTOR'),
        api.perfilPermissoes.get('OPERADOR'),
      ]);
      setGestor(permissoesApiParaBloco(gRow.permissoes, 'GESTOR'));
      setOperador(permissoesApiParaBloco(oRow.permissoes, 'OPERADOR'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar permissões');
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const toggleCell = (
    alvo: 'gestor' | 'operador',
    setor: (typeof SETORES)[number],
    mod: ModuloPermissao,
    ac: AcaoPermissao
  ) => {
    if (!modoEdicao || !canEdit || !podeEditarPermissoesPainel) return;
    const patch = (prev: BlocoPerfilState): BlocoPerfilState => ({
      ...prev,
      acessoTotal: false,
      porSetor: {
        ...prev.porSetor,
        [setor]: {
          ...prev.porSetor[setor],
          [mod]: {
            ...prev.porSetor[setor][mod],
            [ac]: !prev.porSetor[setor][mod]?.[ac],
          },
        },
      },
    });
    if (alvo === 'gestor') setGestor(patch);
    else setOperador(patch);
  };

  const marcarTodosModulo = (
    alvo: 'gestor' | 'operador',
    setor: (typeof SETORES)[number],
    mod: ModuloPermissao,
    valor: boolean
  ) => {
    if (!modoEdicao || !canEdit || !podeEditarPermissoesPainel) return;
    const patch = (prev: BlocoPerfilState): BlocoPerfilState => ({
      ...prev,
      acessoTotal: false,
      porSetor: {
        ...prev.porSetor,
        [setor]: {
          ...prev.porSetor[setor],
          [mod]: Object.fromEntries(ACAO_PERMISSAO_VALUES.map((a) => [a, valor])) as Record<string, boolean>,
        },
      },
    });
    if (alvo === 'gestor') setGestor(patch);
    else setOperador(patch);
  };

  const setAcessoTotalBloco = (alvo: 'gestor' | 'operador', v: boolean, modulos: ModuloPermissao[]) => {
    if (alvo === 'gestor') {
      setGestor({
        acessoTotal: v,
        porSetor: Object.fromEntries(
          SETORES.map((s) => [s, matrixFromPermissoesApi(null, modulos, v)])
        ) as BlocoPerfilState['porSetor'],
      });
    } else {
      setOperador({
        acessoTotal: v,
        porSetor: Object.fromEntries(
          SETORES.map((s) => [s, matrixFromPermissoesApi(null, modulos, v)])
        ) as BlocoPerfilState['porSetor'],
      });
    }
  };

  const handleSalvar = async () => {
    if (!podeEditarPermissoesPainel) {
      toast.error('Sem permissão para alterar este painel.');
      return;
    }
    setSaving(true);
    try {
      await api.perfilPermissoes.patch('GESTOR', { permissoes: blocoParaPayload(gestor, 'GESTOR') });
      await api.perfilPermissoes.patch('OPERADOR', { permissoes: blocoParaPayload(operador, 'OPERADOR') });
      toast.success('Permissões salvas (gestor e operador, por setor).');
      await loadAll();
      setModoEdicao(false);
      const r = String(user?.role ?? '').toUpperCase();
      if (r === 'GESTOR' || r === 'OPERADOR') {
        await syncSessionFromApi();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const cancelarEdicao = async () => {
    await loadAll({ silent: true });
    setModoEdicao(false);
  };

  const podeAlterar = canEdit && podeEditarPermissoesPainel;

  const renderTabela = (
    tituloPerfil: string,
    alvo: 'gestor' | 'operador',
    bloco: BlocoPerfilState,
    modulos: ModuloPermissao[]
  ) => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-urban-gray-light border-b border-urban-petrol/30 pb-2">
        {tituloPerfil}
      </h2>
      <p className="text-sm text-urban-gray-data">
        Cada bloco abaixo é um <strong className="text-urban-gray-light">setor de unidade</strong>. O sistema aplica
        a matriz do setor do usuário (transporte, mapas ou educação) ao fazer login.
      </p>

      {modoEdicao && (
        <label className="flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer w-fit">
          <input
            type="checkbox"
            className="rounded border-urban-petrol/50"
            checked={bloco.acessoTotal}
            disabled={!podeAlterar}
            onChange={(e) => setAcessoTotalBloco(alvo, e.target.checked, modulos)}
          />
          <span>Acesso total a todos os módulos (todos os setores) — remove restrição no servidor</span>
        </label>
      )}

      {!bloco.acessoTotal &&
        SETORES.map((setor) => {
          const aberto = painelSetorAberto[alvo][setor];
          return (
          <div key={`${alvo}-${setor}`} className="rounded-card border border-urban-petrol/25 overflow-hidden">
            <button
              type="button"
              onClick={() => togglePainelSetor(alvo, setor)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-urban-petrol/15 text-sm font-medium text-urban-gray-light text-left hover:bg-urban-petrol/25 transition-colors"
              aria-expanded={aberto}
            >
              <span>{SETOR_LABEL[setor]}</span>
              <ChevronDown
                className={`shrink-0 text-urban-gray-data transition-transform duration-200 ${aberto ? '' : '-rotate-90'}`}
                size={18}
                aria-hidden
              />
            </button>
            {aberto && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[560px]">
                <thead>
                  <tr className="border-b border-urban-petrol/30 bg-urban-bg/80">
                    <th className="p-3 font-medium text-urban-gray-light w-44">Módulo</th>
                    {ACAO_PERMISSAO_VALUES.map((ac) => (
                      <th key={ac} className="p-2 font-medium text-urban-gray-data text-center w-24">
                        {ACAO_PERMISSAO_LABELS[ac]}
                      </th>
                    ))}
                    {modoEdicao && (
                      <th className="p-2 w-28 text-center text-urban-gray-data text-xs font-medium">Em lote</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((mod) => (
                    <tr key={mod} className="border-b border-urban-petrol/20 hover:bg-white/5">
                      <td className="p-3 font-medium text-urban-gray-light">{MODULO_PERMISSAO_LABELS[mod]}</td>
                      {ACAO_PERMISSAO_VALUES.map((ac) => {
                        const ativo = bloco.porSetor[setor][mod]?.[ac] ?? false;
                        return (
                          <td key={ac} className="p-2 text-center align-middle">
                            {modoEdicao ? (
                              <input
                                type="checkbox"
                                className="rounded border-urban-petrol/50"
                                checked={ativo}
                                disabled={!podeAlterar}
                                onChange={() => toggleCell(alvo, setor, mod, ac)}
                                aria-label={`${setor} ${mod} ${ac}`}
                              />
                            ) : ativo ? (
                              <span className="inline-flex justify-center w-full" title="Permitido">
                                <Check className="text-urban-green" size={18} strokeWidth={2.5} aria-hidden />
                              </span>
                            ) : (
                              <span className="text-urban-gray-data/35 select-none inline-block min-w-[1.25rem]">—</span>
                            )}
                          </td>
                        );
                      })}
                      {modoEdicao && (
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              className="text-xs text-urban-green hover:underline px-0.5"
                              disabled={!podeAlterar}
                              onClick={() => marcarTodosModulo(alvo, setor, mod, true)}
                            >
                              Todos
                            </button>
                            <span className="h-3.5 w-px shrink-0 bg-urban-petrol/50 rounded-full" aria-hidden />
                            <button
                              type="button"
                              className="text-xs text-urban-gray-data hover:underline px-0.5"
                              disabled={!podeAlterar}
                              onClick={() => marcarTodosModulo(alvo, setor, mod, false)}
                            >
                              Nenhum
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
        })}

      {modoEdicao && bloco.acessoTotal && (
        <p className="text-sm text-urban-gray-data">
          Com “acesso total”, ao salvar a restrição por setor é removida no servidor (comportamento legado).
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-urban-gray-light flex items-center gap-2">
          <Shield className="text-urban-green shrink-0" size={28} />
          Permissões por perfil e por setor
        </h1>
        <p className="text-sm text-urban-gray-data mt-1">
          <strong className="text-urban-gray-light">Gestor:</strong> em cada setor (transporte, mapas, educação),
          defina módulo e ações. <strong className="text-urban-gray-light">Operador:</strong> idem (sem módulo
          Usuários). Cada usuário recebe no login a matriz do{' '}
          <strong className="text-urban-gray-light">seu setor de unidade</strong>.
        </p>
      </div>

      {loadingDetail && (
        <div className="flex items-center gap-2 text-urban-gray-data">
          <Loader2 className="animate-spin" size={20} />
          Carregando…
        </div>
      )}

      {!loadingDetail && (
        <div className="space-y-8">
          {!modoEdicao && (
            <div className="rounded-lg border border-urban-petrol/25 bg-urban-bg/40 px-4 py-3 text-sm text-urban-gray-light">
              Visualização das matrizes por setor. Use <strong className="text-urban-gray-data">Editar permissões</strong>{' '}
              para alterar ambos os blocos e salvar de uma vez.
            </div>
          )}

          {renderTabela('Gestor', 'gestor', gestor, modulosGestor)}
          {renderTabela('Operador', 'operador', operador, modulosOperador)}

          {podeAlterar && !modoEdicao && (
            <button
              type="button"
              onClick={() => setModoEdicao(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-urban-green/50 bg-urban-green/10 text-urban-green font-medium hover:bg-urban-green/20 transition-colors"
            >
              <Pencil size={18} />
              Editar permissões
            </button>
          )}

          {podeAlterar && modoEdicao && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void cancelarEdicao()}
                disabled={saving || loadingDetail}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-urban-petrol/40 text-urban-gray-light font-medium hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar edição
              </button>
              <button
                type="button"
                onClick={() => void handleSalvar()}
                disabled={saving || loadingDetail}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-urban-green text-white font-medium hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Salvar permissões
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
