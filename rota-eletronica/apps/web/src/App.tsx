import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PrivateRoute } from '@/components/layout/PrivateRoute';
import { Layout } from '@/components/layout/Layout';
import { Login } from '@/pages/auth/Login';
import { PrimeiroAcesso } from '@/pages/auth/PrimeiroAcesso';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { Home } from '@/pages/dashboard/Home';
import { MapPage } from '@/pages/map/MapPage';
import { RoutingList } from '@/pages/routing/RoutingList';
import { RoutingCreate } from '@/pages/routing/RoutingCreate';
import { RoutingDetail } from '@/pages/routing/RoutingDetail';
import { VeiculosList } from '@/pages/vehicles/VeiculosList';
import { VehicleDetail } from '@/pages/vehicles/VehicleDetail';
import { VehicleCreate } from '@/pages/vehicles/VehicleCreate';
import { VehicleEdit } from '@/pages/vehicles/VehicleEdit';
import { AlunosList } from '@/pages/students/AlunosList';
import { StudentDetail } from '@/pages/students/StudentDetail';
import { StudentCreate } from '@/pages/students/StudentCreate';
import { StudentEdit } from '@/pages/students/StudentEdit';
import { MunicipiosList } from '@/pages/municipalities/MunicipiosList';
import { MunicipalityDetail } from '@/pages/municipalities/MunicipalityDetail';
import { MunicipalityCreate } from '@/pages/municipalities/MunicipalityCreate';
import { MunicipalityEdit } from '@/pages/municipalities/MunicipalityEdit';
import { GaragensList } from '@/pages/garages/GaragensList';
import { GarageDetail } from '@/pages/garages/GarageDetail';
import { GarageCreate } from '@/pages/garages/GarageCreate';
import { GarageEdit } from '@/pages/garages/GarageEdit';
import { MotoristasList } from '@/pages/operacao/MotoristasList';
import { DriverDetail } from '@/pages/operacao/DriverDetail';
import { DriverCreate } from '@/pages/operacao/DriverCreate';
import { DriverEdit } from '@/pages/operacao/DriverEdit';
import { EscalasList } from '@/pages/escalas/EscalasList';
import { ScheduleDetail } from '@/pages/escalas/ScheduleDetail';
import { ScheduleCreate } from '@/pages/escalas/ScheduleCreate';
import { ScheduleEdit } from '@/pages/escalas/ScheduleEdit';
import { ScheduleResumo } from '@/pages/escalas/ScheduleResumo';
import { EscolasList } from '@/pages/schools/EscolasList';
import { SchoolDetail } from '@/pages/schools/SchoolDetail';
import { SchoolCreate } from '@/pages/schools/SchoolCreate';
import { SchoolEdit } from '@/pages/schools/SchoolEdit';
import { Profile } from '@/pages/profile/Profile';
import { Settings } from '@/pages/settings/Settings';
import { AlterarSenha } from '@/pages/settings/AlterarSenha';
import { GestorRoute } from '@/components/layout/GestorRoute';
import { ModuleGuard } from '@/components/layout/ModuleGuard';
import { AdminRoute } from '@/components/layout/AdminRoute';
import { UsuariosList } from '@/pages/usuarios/UsuariosList';
import { UsuarioForm } from '@/pages/usuarios/UsuarioForm';
import { UsuarioDetail } from '@/pages/usuarios/UsuarioDetail';
import { PermissoesPage } from '@/pages/permissoes/PermissoesPage';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage);
  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ModuleGuard modulo="dashboard">
              <Home />
            </ModuleGuard>
          }
        />
        <Route path="perfil" element={<Profile />} />
        <Route
          path="permissoes"
          element={
            <AdminRoute>
              <PermissoesPage />
            </AdminRoute>
          }
        />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="configuracoes/alterar-senha" element={<AlterarSenha />} />
        <Route
          path="mapa"
          element={
            <ModuleGuard modulo="mapa">
              <MapPage />
            </ModuleGuard>
          }
        />
        <Route path="roteirizacao" element={<Outlet />}>
          <Route
            index
            element={
              <ModuleGuard modulo="roteirizacao">
                <RoutingList />
              </ModuleGuard>
            }
          />
          <Route
            path="nova"
            element={
              <ModuleGuard modulo="roteirizacao" acao="criar">
                <RoutingCreate />
              </ModuleGuard>
            }
          />
          <Route
            path=":id/editar"
            element={
              <ModuleGuard modulo="roteirizacao" acao="editar">
                <RoutingCreate />
              </ModuleGuard>
            }
          />
          <Route
            path=":id"
            element={
              <ModuleGuard modulo="roteirizacao">
                <RoutingDetail />
              </ModuleGuard>
            }
          />
        </Route>
        <Route
          path="veiculos/novo"
          element={
            <ModuleGuard modulo="veiculos" acao="criar">
              <VehicleCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="veiculos/editar/:id"
          element={
            <ModuleGuard modulo="veiculos" acao="editar">
              <VehicleEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="veiculos/:id"
          element={
            <ModuleGuard modulo="veiculos">
              <VehicleDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="veiculos"
          element={
            <ModuleGuard modulo="veiculos">
              <VeiculosList />
            </ModuleGuard>
          }
        />
        <Route
          path="alunos/novo"
          element={
            <ModuleGuard modulo="alunos" acao="criar">
              <StudentCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="alunos/editar/:id"
          element={
            <ModuleGuard modulo="alunos" acao="editar">
              <StudentEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="alunos/:id"
          element={
            <ModuleGuard modulo="alunos">
              <StudentDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="alunos"
          element={
            <ModuleGuard modulo="alunos">
              <AlunosList />
            </ModuleGuard>
          }
        />
        <Route
          path="municipios/novo"
          element={
            <ModuleGuard modulo="municipios" acao="criar">
              <MunicipalityCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="municipios/editar/:id"
          element={
            <ModuleGuard modulo="municipios" acao="editar">
              <MunicipalityEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="municipios/:id"
          element={
            <ModuleGuard modulo="municipios">
              <MunicipalityDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="municipios"
          element={
            <ModuleGuard modulo="municipios">
              <MunicipiosList />
            </ModuleGuard>
          }
        />
        <Route
          path="garagens/novo"
          element={
            <ModuleGuard modulo="garagens" acao="criar">
              <GarageCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="garagens/editar/:id"
          element={
            <ModuleGuard modulo="garagens" acao="editar">
              <GarageEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="garagens/:id"
          element={
            <ModuleGuard modulo="garagens">
              <GarageDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="garagens"
          element={
            <ModuleGuard modulo="garagens">
              <GaragensList />
            </ModuleGuard>
          }
        />
        <Route
          path="operacao/motoristas/novo"
          element={
            <ModuleGuard modulo="motoristas" acao="criar">
              <DriverCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="operacao/motoristas/editar/:id"
          element={
            <ModuleGuard modulo="motoristas" acao="editar">
              <DriverEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="operacao/motoristas/:id"
          element={
            <ModuleGuard modulo="motoristas">
              <DriverDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="operacao/motoristas"
          element={
            <ModuleGuard modulo="motoristas">
              <MotoristasList />
            </ModuleGuard>
          }
        />
        <Route
          path="escalas/novo"
          element={
            <ModuleGuard modulo="escalas" acao="criar">
              <ScheduleCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="escalas/editar/:id"
          element={
            <ModuleGuard modulo="escalas" acao="editar">
              <ScheduleEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="escalas/:id/resumo"
          element={
            <ModuleGuard modulo="escalas">
              <ScheduleResumo />
            </ModuleGuard>
          }
        />
        <Route
          path="escalas/:id"
          element={
            <ModuleGuard modulo="escalas">
              <ScheduleDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="escalas"
          element={
            <ModuleGuard modulo="escalas">
              <EscalasList />
            </ModuleGuard>
          }
        />
        <Route
          path="escolas/novo"
          element={
            <ModuleGuard modulo="escolas" acao="criar">
              <SchoolCreate />
            </ModuleGuard>
          }
        />
        <Route
          path="escolas/editar/:id"
          element={
            <ModuleGuard modulo="escolas" acao="editar">
              <SchoolEdit />
            </ModuleGuard>
          }
        />
        <Route
          path="escolas/:id"
          element={
            <ModuleGuard modulo="escolas">
              <SchoolDetail />
            </ModuleGuard>
          }
        />
        <Route
          path="escolas"
          element={
            <ModuleGuard modulo="escolas">
              <EscolasList />
            </ModuleGuard>
          }
        />
        <Route path="usuarios" element={<GestorRoute />}>
          <Route
            index
            element={
              <ModuleGuard modulo="usuarios">
                <UsuariosList />
              </ModuleGuard>
            }
          />
          <Route
            path="novo"
            element={
              <ModuleGuard modulo="usuarios" acao="criar">
                <UsuarioForm />
              </ModuleGuard>
            }
          />
          <Route
            path="editar/:id"
            element={
              <ModuleGuard modulo="usuarios" acao="editar">
                <UsuarioForm />
              </ModuleGuard>
            }
          />
          <Route
            path=":id"
            element={
              <ModuleGuard modulo="usuarios">
                <UsuarioDetail />
              </ModuleGuard>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
