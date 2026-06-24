import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="h-14 bg-sidebar border-b border-white/20 flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white overflow-hidden">
              {user?.photo ? (
                <img src={user.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) ?? '?'
              )}
            </div>
            <span className="text-sm font-medium text-white hidden sm:block">{user?.name}</span>
            <ChevronDown size={16} className="text-white/80" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 py-1 bg-sidebar border border-white/20 rounded-card shadow-lg z-20">
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/perfil');
                  }}
                >
                  Meu Perfil
                </button>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/configuracoes');
                  }}
                >
                  Configurações
                </button>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-red-200 hover:bg-red-500/20"
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                    navigate('/login');
                  }}
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
