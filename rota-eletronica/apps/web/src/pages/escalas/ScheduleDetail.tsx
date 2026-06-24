import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Pencil, Trash2, AlertCircle, Map, FileText, Route, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSchedulesStore } from '@/store/schedulesStore';
import { useRoutesStore } from '@/store/routesStore';
import { useDriversStore } from '@/store/driversStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useMapFiltersStore } from '@/store/mapFiltersStore';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { MapContainer } from '@/components/maps/MapContainer';
import { api } from '@/services/api';
import type { Student } from '@rota-eletronica/shared-types';
import { shiftLabel } from '@rota-eletronica/shared-types';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getScheduleById = useSchedulesStore((s) => s.getScheduleById);
  const removeSchedule = useSchedulesStore((s) => s.removeSchedule);
  const getRouteById = useRoutesStore((s) => s.getRouteById);
  const getDriverById = useDriversStore((s) => s.getDriverById);
  const getVehicleById = useVehiclesStore((s) => s.getVehicleById);
  const municipalities = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const setFiltersFromSchedule = useMapFiltersStore((s) => s.setFiltersFromSchedule);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const schedule = id ? getScheduleById(id) : undefined;
  const route = schedule ? getRouteById(schedule.routeId) : undefined;
  const driver = schedule ? getDriverById(schedule.driverId) : undefined;
  const vehicle = schedule ? getVehicleById(schedule.vehicleId) : undefined;
  const municipality = route ? municipalities.find((m) => m.id === route.municipalityId) : undefined;
  const school = useMemo(() => (route ? getSchools().find((s) => s.id === route.schoolId) : undefined), [route, getSchools]);
  const mapRoutes = useMemo(() => (route ? [route] : []), [route]);
  const mapSchools = useMemo(() => (school ? [school] : []), [school]);
  const mapVehiclePositions = useMemo(
    () => (route && vehicle ? [{ vehicle, lat: route.origin.lat, lng: route.origin.lng }] : []),
    [route, vehicle]
  );
  const [studentsByRoute, setStudentsByRoute] = useState<Student[]>([]);
  const [studentsBySchool, setStudentsBySchool] = useState<Student[]>([]);
  const [excluirAberto, setExcluirAberto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStudentsByRoute([]);
    setStudentsBySchool([]);
    if (!route) return;

    (async () => {
      try {
        const routeRes = await api.students.list({ routeId: route.id, page: 1, pageSize: 200 });
        const routeList = Array.isArray(routeRes) ? (routeRes as Student[]) : ((routeRes as { data: Student[] }).data ?? []);
        if (cancelled) return;
        setStudentsByRoute(routeList);
        if (routeList.length > 0) return;

        const schoolRes = await api.students.list({ schoolId: route.schoolId, municipalityId: route.municipalityId, page: 1, pageSize: 200 });
        const schoolList = Array.isArray(schoolRes) ? (schoolRes as Student[]) : ((schoolRes as { data: Student[] }).data ?? []);
        if (!cancelled) setStudentsBySchool(schoolList);
      } catch {
        if (!cancelled) {
          setStudentsByRoute([]);
          setStudentsBySchool([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route?.id, route?.schoolId, route?.municipalityId]);

  const shownStudents = studentsByRoute.length > 0 ? studentsByRoute : studentsBySchool;
  const showingSchoolFallback = studentsByRoute.length === 0 && studentsBySchool.length > 0;
  const scheduleDisplayName = route
    ? `Escala ${route.name}${school ? ` (${school.name})` : ''}`
    : schedule?.name ?? '';

  if (!schedule) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Escala não encontrada.{' '}
        <Link to="/escalas" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  const confirmarExcluir = () => {
    if (!id || !schedule) return;
    removeSchedule(id);
    toast.success('Escala excluída.');
    setExcluirAberto(false);
    navigate('/escalas');
  };

  const handleAcompanharRota = () => {
    if (!schedule?.routeId || !route) return;
    setFiltersFromSchedule({
      municipalityId: route.municipalityId,
      routeId: schedule.routeId,
      schoolId: route.schoolId,
      shift: schedule.shift ?? '',
    });
    navigate('/mapa');
  };

  return (
    <div className="space-y-4">
      <Link to="/escalas" className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green">
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to={`/escalas/editar/${id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </Link>
        <button
          type="button"
          onClick={() => setExcluirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg font-semibold text-urban-gray-light">{scheduleDisplayName}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${schedule.status === 'scheduled' ? 'bg-urban-gray-data/20 text-urban-gray-data' : schedule.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : schedule.status === 'completed' ? 'bg-urban-green/20 text-urban-green' : 'bg-red-500/20 text-red-400'}`}>
            {STATUS_LABELS[schedule.status] ?? schedule.status}
          </span>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <CalendarDays className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Data e turno</p>
              <p className="text-urban-gray-light text-sm font-medium">
                {formatDate(schedule.date)} • {shiftLabel(schedule.shift)} — {schedule.startTime} às {schedule.endTime}
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Rota</p>
            {route ? (
              <Link to={`/roteirizacao/${route.id}`} className="text-urban-green hover:underline font-medium">{route.name}</Link>
            ) : (
              <p className="text-urban-gray-light text-sm">-</p>
            )}
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Município</p>
            <p className="text-urban-gray-light text-sm font-medium">{municipality?.name ?? '-'}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Veículo</p>
            {vehicle ? (
              <Link to={`/veiculos/${vehicle.id}`} className="text-urban-green hover:underline font-medium">{vehicle.plate} — {vehicle.brand} {vehicle.model}</Link>
            ) : (
              <p className="text-urban-gray-light text-sm">-</p>
            )}
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 sm:col-span-2">
            <p className="text-urban-gray-data text-xs mb-1">Motorista</p>
            {driver ? (
              <Link to={`/operacao/motoristas/${driver.id}`} className="text-urban-green hover:underline font-medium">{driver.name}</Link>
            ) : (
              <p className="text-urban-gray-light text-sm">-</p>
            )}
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-urban-gray-data text-xs flex items-center gap-1.5">
                <Users size={14} /> {showingSchoolFallback ? 'Alunos da escola destino' : 'Alunos da rota'}
              </p>
              <Link
                to={`/alunos?${new URLSearchParams(
                  showingSchoolFallback
                    ? { municipalityId: route?.municipalityId ?? '', schoolId: route?.schoolId ?? '' }
                    : { routeId: route?.id ?? '', municipalityId: route?.municipalityId ?? '', schoolId: route?.schoolId ?? '' }
                ).toString()}`}
                className="text-urban-green hover:underline text-xs font-medium"
              >
                Ver todos
              </Link>
            </div>
            <p className="text-sm text-urban-gray-light mb-2">
              Total: <span className="font-semibold tabular-nums">{shownStudents.length}</span>
            </p>
            {shownStudents.length > 0 ? (
              <ul className="space-y-1.5 max-h-28 overflow-y-auto text-sm text-urban-gray-light">
                {shownStudents.slice(0, 6).map((st) => (
                  <li key={st.id} className="truncate">{st.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-urban-gray-data text-sm">Nenhum aluno encontrado para esta escala.</p>
            )}
          </div>
        </div>
      </div>

      {schedule.incidents && schedule.incidents.length > 0 && (
        <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
          <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex items-center gap-2">
            <AlertCircle className="text-urban-green" size={20} />
            <h2 className="text-lg font-semibold text-urban-gray-light">Ocorrências</h2>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {schedule.incidents.map((inc) => (
                <li key={inc.id} className="rounded-lg bg-white/5 border border-urban-petrol/20 p-3 text-sm">
                  <p className="font-medium text-urban-gray-light">{inc.type}</p>
                  <p className="text-urban-gray-data mt-0.5">{inc.description}</p>
                  <p className="text-urban-gray-data text-xs mt-1">{inc.status === 'resolved' ? 'Resolvido' : 'Ativo'}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {route && schedule.status !== 'cancelled' && (
        <div className="rounded-card border border-urban-petrol/30 overflow-hidden relative h-[220px] w-full">
          <div className="absolute inset-0 z-0">
            <MapContainer
              filteredRoutes={mapRoutes}
              filteredSchools={mapSchools}
              vehiclePositions={mapVehiclePositions}
              singleRouteMode
              mapContainerStyle={{ width: '100%', height: '100%', minHeight: 0 }}
              showAddressSearch={false}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            {schedule.status === 'in_progress' && (
              <button
                type="button"
                onClick={handleAcompanharRota}
                className="pointer-events-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-urban-green/85 text-white hover:bg-urban-green font-medium transition-colors border-2 border-urban-green shadow-lg"
              >
                <Map size={20} />
                Acompanhar rota em tempo real
              </button>
            )}
            {schedule.status === 'completed' && (
              <Link
                to={`/escalas/${id}/resumo`}
                className="pointer-events-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-urban-green/85 text-white hover:bg-urban-green font-medium transition-colors border-2 border-urban-green shadow-lg"
              >
                <FileText size={20} />
                Ver resumo da rota
              </Link>
            )}
            {schedule.status === 'scheduled' && (
              <Link
                to={`/roteirizacao/${route.id}`}
                className="pointer-events-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-urban-green/85 text-white hover:bg-urban-green font-medium transition-colors border-2 border-urban-green shadow-lg"
              >
                <Route size={20} />
                Ver rota planejada
              </Link>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir a escala "${schedule.name}"?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
