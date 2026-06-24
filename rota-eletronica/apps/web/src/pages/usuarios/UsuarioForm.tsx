import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { maskCpf, maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';
import { api } from '@/services/api';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { normalizeCpfDigits } from '@/utils/cpf';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole } from '@/utils/permissoes';

const labelClass = 'block text-sm font-medium text-urban-gray-data mb-1.5';
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-urban-petrol/30 bg-urban-bg text-urban-gray-light placeholder:text-urban-gray-data/50';

const passwordToggleBtnClass =
  'absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-urban-gray-data hover:text-urban-gray-light hover:bg-white/10 transition-colors';

const SETORES = [
  { value: 'SETOR_TRANSPORTE', label: 'Setor de transporte' },
  { value: 'SETOR_MAPAS', label: 'Setor de mapas' },
  { value: 'SETOR_EDUCACAO', label: 'Setor de educação' },
];

export function UsuarioForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const podeDefinirPerfilAdmin = isAdminRole(authUser?.role);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);

  const [loading, setLoading] = useState(isEdit);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [perfil, setPerfil] = useState<'ADMIN' | 'GESTOR' | 'OPERADOR' | ''>('');
  const [ufAtuacao, setUfAtuacao] = useState('');
  const [municipioIds, setMunicipioIds] = useState<string[]>([]);
  const [setorUnidade, setSetorUnidade] = useState('');
  const [status, setStatus] = useState<'ATIVO' | 'INATIVO' | 'BLOQUEADO'>('ATIVO');

  const ufsDisponiveis = useMemo(
    () => Array.from(new Set(municipalitiesList.map((m) => m.state))).sort(),
    [municipalitiesList]
  );

  const municipiosNaUf = useMemo(() => {
    if (!ufAtuacao) return [];
    return municipalitiesList.filter((m) => m.state === ufAtuacao).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [municipalitiesList, ufAtuacao]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    api.usuarios
      .get(id)
      .then((row) => {
        if (cancelled) return;
        setNomeCompleto(String(row.nomeCompleto ?? ''));
        setCpf(maskCpf(String(row.cpf ?? '')));
        setTelefone(maskPhone(String(row.telefone ?? '')));
        setEmail(String(row.email ?? ''));
        setLogin(String(row.login ?? ''));
        setPerfil((row.perfil as 'ADMIN' | 'GESTOR' | 'OPERADOR') ?? 'OPERADOR');
        setUfAtuacao(String(row.ufAtuacao ?? ''));
        const mids = row.municipioIds;
        setMunicipioIds(Array.isArray(mids) ? mids.map(String) : []);
        setSetorUnidade(String(row.setorUnidade ?? ''));
        setStatus((row.status as typeof status) ?? 'ATIVO');
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  const toggleMunicipio = (mid: string) => {
    setMunicipioIds((prev) => (prev.includes(mid) ? prev.filter((x) => x !== mid) : [...prev, mid]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfDigits = normalizeCpfDigits(cpf);
    if (!nomeCompleto.trim()) {
      toast.error('Informe o nome completo');
      return;
    }
    if (!cpfDigits) {
      toast.error('Informe o CPF');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('E-mail inválido');
      return;
    }
    const phoneDigits = unmaskDigits(telefone);
    if (!phoneDigits) {
      toast.error('Informe o telefone');
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error('Telefone inválido (use DDD + número)');
      return;
    }
    if (!login.trim() || login.trim().length < 3) {
      toast.error('Login deve ter ao menos 3 caracteres');
      return;
    }
    if (!perfil) {
      toast.error('Selecione o perfil');
      return;
    }
    if (perfil !== 'ADMIN') {
      if (!ufAtuacao) {
        toast.error('Selecione a UF de atuação');
        return;
      }
      if (municipioIds.length === 0) {
        toast.error('Selecione ao menos uma cidade de atuação na UF');
        return;
      }
      if (!setorUnidade) {
        toast.error('Selecione o setor (unidade)');
        return;
      }
    } else {
      if (municipioIds.length > 0 && !ufAtuacao) {
        toast.error('Selecione a UF quando houver cidades de atuação');
        return;
      }
    }

    if (!isEdit) {
      if (!password) {
        toast.error('Senha é obrigatória na criação');
        return;
      }
      if (password !== confirmarSenha) {
        toast.error('Confirmação de senha não confere');
        return;
      }
    } else {
      if (password && password !== confirmarSenha) {
        toast.error('Confirmação de senha não confere');
        return;
      }
    }

    try {
      const base: Record<string, unknown> = {
        nomeCompleto: nomeCompleto.trim(),
        cpf: cpfDigits,
        email: email.trim().toLowerCase(),
        telefone: phoneDigits,
        login: login.trim().toLowerCase(),
        perfil,
        ufAtuacao: perfil === 'ADMIN' && municipioIds.length === 0 ? '' : ufAtuacao,
        municipioIds: perfil === 'ADMIN' && municipioIds.length === 0 ? [] : municipioIds,
        setorUnidade,
      };
      if (isEdit && id) {
        const body: Record<string, unknown> = { ...base, status };
        if (password) {
          body.password = password;
          body.confirmarSenha = confirmarSenha;
        }
        await api.usuarios.update(id, body);
        toast.success('Usuário atualizado');
      } else {
        await api.usuarios.create({
          ...base,
          password,
          confirmarSenha,
        });
        toast.success('Usuário criado');
      }
      navigate('/usuarios');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (loading) {
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

      <h1 className="text-xl font-semibold text-urban-gray-light">{isEdit ? 'Editar usuário' : 'Novo usuário'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6 flex flex-col flex-1 min-h-0">
        <section className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-6 space-y-4">
          <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Dados pessoais</h2>
          <div>
            <label className={labelClass}>Nome completo *</label>
            <input
              className={inputClass}
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>CPF *</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className={labelClass}>Telefone *</label>
              <input
                type="text"
                inputMode="tel"
                autoComplete="tel"
                className={inputClass}
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>E-mail *</label>
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </section>

        <section className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-6 space-y-4">
          <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Credenciais</h2>
          <div>
            <label className={labelClass}>Login *</label>
            <input className={inputClass} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{isEdit ? 'Nova senha (opcional)' : 'Senha *'}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isEdit ? 'new-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={passwordToggleBtnClass}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{isEdit ? 'Confirmar nova senha' : 'Confirmar senha *'}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className={passwordToggleBtnClass}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-6 space-y-4">
          <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Perfil e vínculo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Perfil *</label>
              {isEdit && perfil === 'ADMIN' && !podeDefinirPerfilAdmin ? (
                <div className={`${inputClass} cursor-not-allowed opacity-90`}>
                  <span className="text-urban-gray-light">Administrador</span>
                  <p className="text-xs text-urban-gray-data mt-2 font-normal">
                    Apenas um administrador pode alterar o perfil deste usuário.
                  </p>
                </div>
              ) : (
                <select
                  className={inputClass}
                  value={perfil}
                  onChange={(e) => {
                    const p = e.target.value as 'ADMIN' | 'GESTOR' | 'OPERADOR';
                    setPerfil(p);
                    if (p === 'ADMIN') {
                      setUfAtuacao('');
                      setMunicipioIds([]);
                    }
                  }}
                  required
                >
                  <option value="">Selecione</option>
                  {podeDefinirPerfilAdmin && <option value="ADMIN">Administrador</option>}
                  <option value="GESTOR">Gestor</option>
                  <option value="OPERADOR">Operador</option>
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>
                {perfil === 'ADMIN' ? 'UF de atuação (opcional)' : 'UF de atuação *'}
              </label>
              <select
                className={inputClass}
                value={ufAtuacao}
                onChange={(e) => {
                  const v = e.target.value;
                  setUfAtuacao(v);
                  setMunicipioIds([]);
                }}
                required={perfil !== 'ADMIN' && perfil !== ''}
              >
                <option value="">{perfil === 'ADMIN' ? 'Nenhuma' : 'Selecione a UF'}</option>
                {ufsDisponiveis.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>{perfil === 'ADMIN' ? 'Unidade (setor)' : 'Unidade (setor) *'}</label>
              <select
                className={inputClass}
                value={setorUnidade}
                onChange={(e) => setSetorUnidade(e.target.value)}
                required={perfil !== 'ADMIN' && perfil !== ''}
              >
                <option value="">Selecione</option>
                {SETORES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {perfil !== '' && perfil !== 'ADMIN' && (
            <div>
              <label className={labelClass}>Cidades de atuação (mesma UF) *</label>
              {!ufAtuacao ? (
                <p className="text-sm text-urban-gray-data">Selecione primeiro a UF.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-urban-petrol/30 bg-urban-bg/50 p-3 space-y-2">
                  {municipiosNaUf.length === 0 ? (
                    <p className="text-sm text-urban-gray-data">Nenhum município cadastrado nesta UF.</p>
                  ) : (
                    municipiosNaUf.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-urban-petrol/50"
                          checked={municipioIds.includes(m.id)}
                          onChange={() => toggleMunicipio(m.id)}
                        />
                        <span>{m.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {perfil === 'ADMIN' && (
            <>
              <p className="text-sm text-urban-gray-data">
                Opcional: escolha UF e uma ou mais cidades para restringir a visão de dados do administrador a esses
                municípios.
              </p>
              {ufAtuacao ? (
                <div>
                  <label className={labelClass}>Cidades (opcional)</label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-urban-petrol/30 bg-urban-bg/50 p-3 space-y-2">
                    {municipiosNaUf.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-urban-petrol/50"
                          checked={municipioIds.includes(m.id)}
                          onChange={() => toggleMunicipio(m.id)}
                        />
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {isEdit && (
          <section className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-6 space-y-4">
            <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Controle</h2>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="BLOQUEADO">Bloqueado</option>
              </select>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-urban-petrol/30">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            Salvar
          </button>
          <Link
            to="/usuarios"
            className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
