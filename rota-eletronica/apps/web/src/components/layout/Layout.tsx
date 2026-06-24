import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { bootstrapAllAppData } from '@/services/appBootstrap';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/perfil': 'Meu perfil',
  '/permissoes': 'Permissões',
  '/configuracoes': 'Configurações',
  '/mapa': 'Monitoramento',
  '/roteirizacao': 'Roteirização',
  '/escalas': 'Escalas',
  '/veiculos': 'Veículos',
  '/alunos': 'Alunos',
  '/municipios': 'Municípios',
  '/garagens': 'Garagem',
  '/operacao/motoristas': 'Motoristas',
  '/escolas': 'Escolas',
};

function getPageTitle(path: string): string {
  if (routeTitles[path]) return routeTitles[path];
  if (path === '/roteirizacao/nova') return 'Nova Rota';
  if (path.includes('/editar') && path.startsWith('/roteirizacao/')) return 'Editar Rota';
  if (path.startsWith('/roteirizacao/')) return 'Detalhe da Rota';
  if (path === '/veiculos/novo') return 'Novo Veículo';
  if (path.startsWith('/veiculos/editar/')) return 'Editar Veículo';
  if (path.startsWith('/veiculos/')) return 'Detalhe do Veículo';
  if (path === '/alunos/novo') return 'Novo Aluno';
  if (path.startsWith('/alunos/editar/')) return 'Editar Aluno';
  if (path.startsWith('/alunos/')) return 'Detalhe do Aluno';
  if (path === '/municipios/novo') return 'Novo Município';
  if (path.startsWith('/municipios/editar/')) return 'Editar Município';
  if (path.startsWith('/municipios/')) return 'Detalhe do Município';
  if (path === '/garagens/novo') return 'Nova Garagem';
  if (path.startsWith('/garagens/editar/')) return 'Editar Garagem';
  if (path.startsWith('/garagens/')) return 'Detalhe da Garagem';
  if (path === '/operacao/motoristas/novo') return 'Novo Motorista';
  if (path.startsWith('/operacao/motoristas/editar/')) return 'Editar Motorista';
  if (path.startsWith('/operacao/motoristas/')) return 'Detalhe do Motorista';
  if (path === '/escalas/novo') return 'Nova Escala';
  if (path.startsWith('/escalas/editar/')) return 'Editar Escala';
  if (path.includes('/escalas/') && path.endsWith('/resumo')) return 'Resumo da rota';
  if (path.startsWith('/escalas/')) return 'Detalhe da Escala';
  if (path === '/escolas/novo') return 'Nova Escola';
  if (path.startsWith('/escolas/editar/')) return 'Editar Escola';
  if (path.startsWith('/escolas/')) return 'Detalhe da Escola';
  if (path === '/usuarios/novo') return 'Novo usuário';
  if (path.startsWith('/usuarios/editar/')) return 'Editar usuário';
  if (path.startsWith('/usuarios/')) return 'Detalhe do usuário';
  if (path === '/usuarios') return 'Usuários';
  if (path === '/perfil') return 'Meu perfil';
  if (path === '/configuracoes') return 'Configurações';
  return 'UrbanData';
}

export function Layout() {
  const location = useLocation();
  const path = location.pathname;
  const title = getPageTitle(path);
  const [appDataReady, setAppDataReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapAllAppData();
      if (!cancelled) setAppDataReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!appDataReady) {
    return (
      <div className="flex min-h-screen bg-urban-bg items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div
            className="inline-block h-10 w-10 border-2 border-urban-green border-t-transparent rounded-full animate-spin mb-4"
            aria-hidden
          />
          <p className="text-urban-gray-light font-medium">Carregando dados do sistema…</p>
          <p className="text-sm text-urban-gray-data mt-2">
            Buscando municípios, escolas, veículos e demais cadastros em paralelo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-urban-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="content-area flex-1 flex flex-col min-h-0 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
