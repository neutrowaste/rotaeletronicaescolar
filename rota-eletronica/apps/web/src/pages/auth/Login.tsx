import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';

export function Login() {
  const [loginOrEmail, setLoginOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPrimeiroAcesso, setShowPrimeiroAcesso] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => {
    api.auth
      .bootstrapEligible()
      .then((r) => setShowPrimeiroAcesso(r.eligible))
      .catch(() => setShowPrimeiroAcesso(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(loginOrEmail, password);
      if (ok) {
        toast.success('Login realizado com sucesso');
        navigate('/dashboard', { replace: true });
      } else {
        toast.error('Login ou senha incorretos');
      }
    } finally {
      setLoading(false);
    }
  };

  /* Partículas fixas para efeito "data waves" (posições pré-definidas) */
  const particles = [
    { x: '10%', y: '55%', s: 2, o: 0.4 }, { x: '22%', y: '72%', s: 3, o: 0.5 }, { x: '35%', y: '48%', s: 2, o: 0.35 },
    { x: '48%', y: '65%', s: 2, o: 0.45 }, { x: '58%', y: '78%', s: 3, o: 0.4 }, { x: '72%', y: '52%', s: 2, o: 0.5 },
    { x: '85%', y: '68%', s: 2, o: 0.35 }, { x: '15%', y: '82%', s: 2, o: 0.45 }, { x: '42%', y: '88%', s: 3, o: 0.4 },
    { x: '68%', y: '42%', s: 2, o: 0.5 }, { x: '92%', y: '58%', s: 2, o: 0.35 }, { x: '28%', y: '62%', s: 2, o: 0.45 },
    { x: '55%', y: '75%', s: 3, o: 0.4 }, { x: '78%', y: '85%', s: 2, o: 0.5 }, { x: '8%', y: '45%', s: 2, o: 0.35 },
  ];

  return (
    <div className="auth-page login-waves min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
      {/* Ondas sobrepostas (formas curvas) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#197c63" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#1a8a6e" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a8a6e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#134D5F" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#134D5F" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0d394f" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {/* Onda 1 - suave superior */}
          <path fill="url(#waveGrad1)" d="M0,400 Q300,350 600,400 T1200,400 L1200,800 L0,800 Z" />
          {/* Onda 2 - meio */}
          <path fill="url(#waveGrad2)" d="M0,500 Q400,450 800,500 T1200,480 L1200,800 L0,800 Z" />
          {/* Onda 3 - mais baixa */}
          <path fill="url(#waveGrad3)" d="M0,600 Q350,550 700,600 T1200,580 L1200,800 L0,800 Z" />
          {/* Onda 4 - profundidade */}
          <path fill="#0d394f" fillOpacity="0.2" d="M0,650 Q500,600 1000,650 L1200,620 L1200,800 L0,800 Z" />
        </svg>
      </div>
      {/* Partículas brancas sutis */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: p.x,
              top: p.y,
              width: p.s,
              height: p.s,
              opacity: p.o,
            }}
            aria-hidden
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md animate-login-fade-in">
        <div className="relative rounded-2xl border border-gray-200/80 shadow-xl p-8 sm:p-10 bg-[#f5f5f5]">
          {/* Logo: símbolo + UrbanData — fundo do card igual ao da imagem para não marcar */}
          <div className="flex justify-center items-center gap-0.5 mb-6">
            <img src="/simbolo-urbandata.jpeg" alt="" className="h-16 w-auto object-contain" aria-hidden />
            <div className="flex items-center">
              <span className="text-2xl font-bold text-urban-brand">Urban</span>
              <span className="text-2xl font-bold text-urban-gray-data">Data</span>
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-urban-gray-light text-center mb-8">ROTA ELETRÔNICA</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-urban-gray-light mb-1.5">
                Login ou e-mail
              </label>
              <input
                id="login"
                type="text"
                autoComplete="username"
                value={loginOrEmail}
                onChange={(e) => setLoginOrEmail(e.target.value)}
                placeholder="login ou seu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/90 text-urban-gray-light placeholder-urban-gray-data/60 focus:outline-none focus:ring-2 focus:ring-[#20B573] focus:border-[#20B573] transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-urban-gray-light mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200/80 bg-white/90 text-urban-gray-light placeholder-urban-gray-data/60 focus:outline-none focus:ring-2 focus:ring-[#20B573] focus:border-[#20B573] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-urban-gray-data hover:text-urban-gray-light hover:bg-white/60 transition-colors duration-200"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 bg-white text-[#20B573] focus:ring-2 focus:ring-[#20B573] focus:ring-offset-0 transition-colors"
              />
              <span className="text-sm text-urban-gray-data">Lembrar-me</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#20B573] to-[#21B076] text-white font-semibold shadow-lg shadow-[#21B076]/30 hover:shadow-xl hover:shadow-[#21B076]/40 hover:brightness-105 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="mt-6 text-center space-y-2">
            {showPrimeiroAcesso && (
              <span className="block">
                <Link
                  to="/primeiro-acesso"
                  className="text-sm font-medium text-urban-green hover:underline transition-colors duration-200"
                >
                  Primeiro acesso — cadastrar gestor
                </Link>
              </span>
            )}
            <Link
              to="/esqueci-senha"
              className="text-sm font-medium text-urban-gray-data hover:text-urban-gray-light hover:underline transition-colors duration-200"
            >
              Esqueci minha senha
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
