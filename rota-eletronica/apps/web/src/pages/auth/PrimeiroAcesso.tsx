import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { maskCpf, maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';
import { api } from '@/services/api';
import { mapApiUserToWebUser, useAuthStore } from '@/store/authStore';
import { normalizeCpfDigits } from '@/utils/cpf';
import { isPaginated } from '@/utils/pagination';
import type { Municipality } from '@rota-eletronica/shared-types';

const labelClass = 'block text-sm font-medium text-urban-gray-light mb-1.5';
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white/90 text-urban-gray-light placeholder:text-urban-gray-data/60';

const passwordToggleBtnClass =
  'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-urban-gray-data hover:text-urban-gray-light hover:bg-white/60 transition-colors duration-200';

const SETORES = [
  { value: 'SETOR_TRANSPORTE', label: 'Setor de transporte' },
  { value: 'SETOR_MAPAS', label: 'Setor de mapas' },
  { value: 'SETOR_EDUCACAO', label: 'Setor de educação' },
];

export function PrimeiroAcesso() {
  const navigate = useNavigate();
  const applySession = useAuthStore((s) => s.applySession);

  const [eligible, setEligible] = useState<boolean | null>(null);
  const [municipios, setMunicipios] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [municipioId, setMunicipioId] = useState('');
  const [setorUnidade, setSetorUnidade] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.auth
      .bootstrapEligible()
      .then((r) => {
        if (!cancelled) setEligible(r.eligible);
      })
      .catch(() => {
        if (!cancelled) setEligible(false);
      });
    api.municipalities
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = isPaginated<Municipality>(res) ? res.data : Array.isArray(res) ? (res as Municipality[]) : [];
        setMunicipios(list);
      })
      .catch(() => setMunicipios([]));
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!password) {
      toast.error('Informe a senha');
      return;
    }
    if (password !== confirmarSenha) {
      toast.error('Confirmação de senha não confere');
      return;
    }
    if (!setorUnidade) {
      toast.error('Selecione o setor');
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.bootstrap({
        nomeCompleto: nomeCompleto.trim(),
        cpf: cpfDigits,
        email: email.trim().toLowerCase(),
        telefone: phoneDigits,
        login: login.trim().toLowerCase(),
        password,
        confirmarSenha,
        ...(municipioId.trim() ? { municipioId: municipioId.trim() } : {}),
        setorUnidade,
      });
      const user = mapApiUserToWebUser(res.user);
      applySession(res.token, user);
      toast.success('Conta criada. Bem-vindo!');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro');
    } finally {
      setLoading(false);
    }
  };

  if (eligible === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-urban-bg text-urban-gray-data">
        Verificando…
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-urban-bg">
        <p className="text-urban-gray-light text-center max-w-md">
          O cadastro inicial só é permitido quando ainda não existe nenhum usuário no sistema. Se já houver um gestor,
          use o login normal.
        </p>
        <Link to="/login" className="text-urban-green font-medium hover:underline">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-urban-bg">
      <div className="w-full max-w-lg rounded-2xl border border-urban-petrol/30 bg-sidebar/90 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-urban-gray-light mb-1">Primeiro acesso</h1>
        <p className="text-sm text-urban-gray-data mb-6">
          Crie o primeiro usuário <strong className="text-urban-green">Gestor</strong> do sistema. Depois você poderá
          cadastrar demais usuários em <em>Usuários</em>.
        </p>

        {municipios.length === 0 && (
          <p className="text-amber-400 text-sm mb-4">
            Cadastre ao menos um município no sistema antes de criar o gestor (menu Municípios). Se este for o primeiro
            acesso ao painel, será necessário criar o município por outro meio ou importar dados — em ambiente local,
            use o fluxo que você já utiliza para popular municípios.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome completo *</label>
            <input className={inputClass} value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div>
            <label className={labelClass}>Login *</label>
            <input className={inputClass} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              <label className={labelClass}>Confirmar senha *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-11`}
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
          <div>
            <label className={labelClass}>Município (opcional)</label>
            <select
              className={inputClass}
              value={municipioId}
              onChange={(e) => setMunicipioId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Unidade (setor) *</label>
            <select className={inputClass} value={setorUnidade} onChange={(e) => setSetorUnidade(e.target.value)} required>
              <option value="">Selecione</option>
              {SETORES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-urban-green text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Salvando…' : 'Criar gestor e entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-urban-gray-data hover:text-urban-gray-light">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
