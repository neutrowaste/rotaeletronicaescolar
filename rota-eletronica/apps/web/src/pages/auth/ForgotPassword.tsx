import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast(
      'Recuperação automática por e-mail ainda não está disponível. Se você está logado, use Configurações → Alterar senha. Caso contrário, peça a um gestor a redefinição da senha.',
      { duration: 6000 }
    );
    setSent(true);
  };

  if (sent) {
    return (
      <div className="auth-page min-h-screen flex items-center justify-center bg-gradient-to-tl from-urban-bg via-urban-green-dark to-urban-petrol p-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-card border border-urban-petrol/30 shadow-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-urban-gray-light mb-2">Recuperação de senha</h1>
          <p className="text-urban-gray-data text-sm mb-6 text-left">
            Nenhum e-mail foi enviado. Para alterar a senha com a conta já autenticada, acesse{' '}
            <strong className="text-urban-gray-light">Configurações → Alterar senha</strong>. Fora do painel,
            solicite a um gestor o reset da senha.
          </p>
          <Link to="/login" className="text-urban-green hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page min-h-screen flex items-center justify-center bg-gradient-to-tl from-urban-bg via-urban-green-dark to-urban-petrol p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-card border border-urban-petrol/30 shadow-xl p-8">
        <h1 className="text-xl font-semibold text-urban-gray-light text-center mb-6">Recuperar senha</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-urban-gray-light mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data/70 focus:outline-none focus:ring-2 focus:ring-urban-green"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            Enviar link de recuperação
          </button>
        </form>
        <p className="mt-4 text-center">
          <Link to="/login" className="text-sm text-urban-green hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
