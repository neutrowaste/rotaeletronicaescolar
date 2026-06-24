import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { mapApiUserToWebUser, useAuthStore } from '@/store/authStore';

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-gray-900 placeholder:text-gray-400';

export function AlterarSenha() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const applySession = useAuthStore((s) => s.applySession);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showA, setShowA] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showC, setShowC] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Faça login novamente.');
      return;
    }
    if (!senhaAtual || !novaSenha || !confirmar) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error('A confirmação não confere com a nova senha.');
      return;
    }
    if (novaSenha.length < 8) {
      toast.error('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const { user: u } = await api.auth.patchMe({
        senhaAtual,
        novaSenha,
        confirmarNovaSenha: confirmar,
      });
      applySession(token, mapApiUserToWebUser(u));
      toast.success('Senha atualizada e salva com segurança no servidor.');
      navigate('/configuracoes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="rounded-card bg-white border border-gray-200 flex-1 flex flex-col p-8 max-w-lg shadow-sm">
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-2 text-sm text-urban-green hover:underline mb-6 w-fit"
        >
          <ArrowLeft size={16} />
          Voltar às configurações
        </Link>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Alterar senha</h2>
        <p className="text-sm text-gray-600 mb-8">
          A nova senha é armazenada com hash seguro (bcrypt) no PostgreSQL — nunca em texto plano.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="senha-atual" className="block text-sm font-medium text-gray-700 mb-1">
              Senha atual
            </label>
            <div className="relative">
              <input
                id="senha-atual"
                type={showA ? 'text' : 'password'}
                autoComplete="current-password"
                className={inputClass + ' pr-10'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500"
                onClick={() => setShowA((v) => !v)}
                aria-label={showA ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showA ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-1">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="nova-senha"
                type={showN ? 'text' : 'password'}
                autoComplete="new-password"
                className={inputClass + ' pr-10'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500"
                onClick={() => setShowN((v) => !v)}
                aria-label={showN ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showN ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirmar-senha" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                id="confirmar-senha"
                type={showC ? 'text' : 'password'}
                autoComplete="new-password"
                className={inputClass + ' pr-10'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500"
                onClick={() => setShowC((v) => !v)}
                aria-label={showC ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showC ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-urban-green text-white font-medium hover:bg-urban-green-medium disabled:opacity-60"
          >
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
