import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Route,
  CalendarDays,
  Bus,
  GraduationCap,
  Building2,
  Warehouse,
  School,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  UserCog,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { isAdminRole, pode, podeAcessarModuloUsuarios } from '@/utils/permissoes';
import { resolvePublicAssetUrl } from '@/utils/publicAssetUrl';
import { ufToEstadoNome } from '@/utils/brazilUfNames';
import type { ModuloPermissao } from '@rota-eletronica/shared-types';

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; modulo: ModuloPermissao };

const navItemsConfig: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', modulo: 'dashboard' },
  { to: '/municipios', icon: Building2, label: 'Municípios', modulo: 'municipios' },
  { to: '/escolas', icon: School, label: 'Escolas', modulo: 'escolas' },
  { to: '/garagens', icon: Warehouse, label: 'Garagem', modulo: 'garagens' },
  { to: '/veiculos', icon: Bus, label: 'Veículos', modulo: 'veiculos' },
  { to: '/operacao/motoristas', icon: Users, label: 'Motoristas', modulo: 'motoristas' },
  { to: '/roteirizacao', icon: Route, label: 'Roteirização', modulo: 'roteirizacao' },
  { to: '/escalas', icon: CalendarDays, label: 'Escalas', modulo: 'escalas' },
  { to: '/alunos', icon: GraduationCap, label: 'Alunos', modulo: 'alunos' },
  { to: '/mapa', icon: Map, label: 'Monitoramento', modulo: 'mapa' },
];

function MunicipalitySidebarTitles({ name, stateUf }: { name: string; stateUf: string }) {
  const estado = ufToEstadoNome(stateUf);
  return (
    <div className="min-w-0 flex-1 flex flex-col justify-center gap-px">
      <span className="truncate text-sm font-bold leading-snug text-urban-brand">{name.trim()}</span>
      {estado ? (
        <span className="truncate text-xs font-normal leading-snug text-white/90">{estado}</span>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  /** Inicia expandido (ex.: após login no dashboard); o usuário pode recolher ao navegar. */
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const getMunicipalityById = useMunicipalitiesStore((s) => s.getMunicipalityById);
  /** Incluído nas dependências para o brasão aparecer assim que o bootstrap carregar os municípios. */
  const municipalityItems = useMunicipalitiesStore((s) => s.items);

  const navItems = navItemsConfig.filter((item) => pode(user, item.modulo, 'visualizar'));

  const branding = useMemo(() => {
    if (!user || isAdminRole(user.role)) return { kind: 'urbandata' as const };
    const mid = user.municipioId ?? user.municipalityIds?.[0];
    if (!mid) return { kind: 'urbandata' as const };
    const m = getMunicipalityById(mid);
    const url = m?.brasaoUrl?.trim();
    if (!m || !url) return { kind: 'urbandata' as const };
    return {
      kind: 'municipio' as const,
      brasaoUrl: resolvePublicAssetUrl(url),
      name: m.name,
      stateUf: m.state,
    };
  }, [user, getMunicipalityById, municipalityItems]);

  return (
    <aside
      className={`bg-sidebar flex flex-col text-white transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="p-3 flex items-center justify-between border-b border-white/10 gap-2">
        {collapsed ? (
          branding.kind === 'municipio' ? (
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mx-auto overflow-hidden p-0.5">
              <img
                src={branding.brasaoUrl}
                alt={branding.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-urban-green flex items-center justify-center mx-auto">
              <span className="font-bold text-white text-sm">U</span>
            </div>
          )
        ) : branding.kind === 'municipio' ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="h-10 w-10 flex-shrink-0 rounded-lg bg-white/5 p-0.5 flex items-center justify-center"
              aria-hidden
            >
              <img
                src={branding.brasaoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <MunicipalitySidebarTitles name={branding.name} stateUf={branding.stateUf} />
          </div>
        ) : (
          <div className="flex items-center min-w-0">
            <span className="font-bold text-urban-brand">Urban</span>
            <span className="font-bold text-white/90">Data</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 text-white/80"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-urban-green/20 text-urban-green border-l-4 border-urban-green'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={22} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        {(podeAcessarModuloUsuarios(user) || isAdminRole(user?.role)) && (
          <div className="space-y-1">
            {podeAcessarModuloUsuarios(user) && (
              <NavLink
                to="/usuarios"
                className={({ isActive }) =>
                  `w-full flex items-center gap-2 rounded-lg py-2.5 transition-colors ${
                    isActive
                      ? 'bg-urban-green/20 text-urban-green border border-urban-green/40'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  } ${collapsed ? 'justify-center' : 'px-3'}`
                }
                title={collapsed ? 'Usuários' : undefined}
              >
                <UserCog size={20} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium">Usuários</span>}
              </NavLink>
            )}
            {isAdminRole(user?.role) && (
              <NavLink
                to="/permissoes"
                className={({ isActive }) =>
                  `w-full flex items-center gap-2 rounded-lg py-2.5 transition-colors ${
                    isActive
                      ? 'bg-urban-green/20 text-urban-green border border-urban-green/40'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  } ${collapsed ? 'justify-center' : 'px-3'}`
                }
                title={collapsed ? 'Permissões' : undefined}
              >
                <Shield size={20} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium">Permissões</span>}
              </NavLink>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className={`mt-1 w-full flex items-center gap-2 rounded-lg py-2 text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-colors ${
            collapsed ? 'justify-center' : 'px-3'
          }`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
