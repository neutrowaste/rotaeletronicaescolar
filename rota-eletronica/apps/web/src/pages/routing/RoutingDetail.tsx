import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Warehouse, ChevronLeft, ChevronRight, Pencil, Trash2, Route, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoutesStore } from '@/store/routesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useStudentsStore } from '@/store/studentsStore';
import { formatDuration, formatKm } from '@rota-eletronica/shared-utils';
import { RouteCreateMap } from '@/components/maps/RouteCreateMap';
import { api } from '@/services/api';
import { decodePolyline } from '@/utils/polylineUtils';
import type { Route as RouteType, School } from '@rota-eletronica/shared-types';
import { shiftLabel } from '@rota-eletronica/shared-types';
import { useScopedMunicipalityIds } from '@/hooks/useScopedMunicipalityIds';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';

function normalizeLngLat(p: unknown): { lat: number; lng: number } | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const lat = Number(o.lat ?? o.latitude);
  const lng = Number(o.lng ?? o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function destinationFromPolyline(poly: string | undefined): { lat: number; lng: number } | null {
  if (!poly?.trim()) return null;
  try {
    const pts = decodePolyline(poly.trim());
    if (pts.length < 1) return null;
    const last = pts[pts.length - 1];
    return { lat: Number(last.lat), lng: Number(last.lng) };
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

export function RoutingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const getRouteById = useRoutesStore((s) => s.getRouteById);
  const isCustomRoute = useRoutesStore((s) => s.isCustomRoute);
  const removeRoute = useRoutesStore((s) => s.removeRoute);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const municipalities = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const studentsList = useStudentsStore((s) => s.getStudents)();
  const routeFromStore = id ? getRouteById(id) : undefined;
  const [routeDetail, setRouteDetail] = useState<RouteType | null>(null);
  const [schoolForMap, setSchoolForMap] = useState<School | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(id));
  const scopedMunicipalityIds = useScopedMunicipalityIds();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const full = (await api.routes.get(id)) as RouteType;
        setRouteDetail(full);
        const schoolsList = useSchoolsStore.getState().getSchools();
        let sch = schoolsList.find((s) => s.id === full.schoolId);
        if (!sch) {
          try {
            sch = (await api.schools.get(full.schoolId)) as School;
          } catch {
            sch = undefined;
          }
        }
        setSchoolForMap(sch ?? null);
      } catch {
        setRouteDetail(null);
        setSchoolForMap(null);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [id]);

  const route = routeDetail ?? routeFromStore;

  useEffect(() => {
    if (!route || scopedMunicipalityIds === null) return;
    const mid = route.municipalityId;
    if (!mid || scopedMunicipalityIds.length === 0 || !scopedMunicipalityIds.includes(mid)) {
      toast.error('Rota fora do seu escopo de atuação.');
      navigate('/roteirizacao', { replace: true });
    }
  }, [route, scopedMunicipalityIds, navigate]);
  const isCustom = route ? isCustomRoute(route.id) : false;
  const schools = getSchools();
  const getGarageById = useGaragesStore((s) => s.getGarageById);

  const handleExcluir = () => {
    if (!id || !route) return;
    if (!isCustom) {
      toast.error('Não é possível excluir rota de demonstração.');
      setDeleteModalOpen(false);
      return;
    }
    removeRoute(id);
    setDeleteModalOpen(false);
    toast.success('Rota excluída.');
    navigate('/roteirizacao');
  };

  const school = schoolForMap ?? (route ? schools.find((s) => s.id === route.schoolId) : undefined);
  const municipality = route ? municipalities.find((m) => m.id === route.municipalityId) : undefined;
  const garage = route?.garageId ? getGarageById(route.garageId) : undefined;

  const linkedStudentsCount = useMemo(
    () => (route ? studentsList.filter((s) => s.routeId === route.id).length : 0),
    [route, studentsList]
  );
  const routeStudentsCount = useMemo(
    () => (route ? Math.max(route.totalStudents ?? 0, linkedStudentsCount) : 0),
    [route, linkedStudentsCount]
  );

  const mapOrigin = useMemo(() => (route ? normalizeLngLat(route.origin) : null), [route]);
  const mapDestination = useMemo(() => {
    if (!route) return null;
    const fromSchool = school ? normalizeLngLat(school.coordinates) : null;
    return fromSchool ?? destinationFromPolyline(route.polyline);
  }, [route, school]);
  const mapStops = useMemo(() => {
    if (!route?.stops?.length) return [];
    return route.stops
      .map((s) => {
        const c = normalizeLngLat(s.coordinates);
        if (!c) return null;
        return {
          id: s.id,
          order: s.order,
          address: s.address ?? '',
          coordinates: c,
        };
      })
      .filter(Boolean) as Array<{ id: string; order: number; address: string; coordinates: { lat: number; lng: number } }>;
  }, [route]);

  const municipalityCenter = municipality?.coordinates
    ? normalizeLngLat(municipality.coordinates)
    : null;

  if (loadingDetail && !routeFromStore) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        <div className="inline-block h-8 w-8 border-2 border-urban-green border-t-transparent rounded-full animate-spin mb-3" aria-hidden />
        <p>Carregando detalhes da rota…</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Rota não encontrada. <Link to="/roteirizacao" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex-1 min-h-[400px] min-w-0 rounded-card overflow-hidden border border-urban-petrol/30 relative h-full">
        <div className="absolute inset-0">
          <RouteCreateMap
            origin={mapOrigin}
            destination={mapDestination}
            stops={mapStops}
            encodedPolyline={route.polyline?.trim() || null}
            municipalityCenter={municipalityCenter}
            municipalityForBounds={
              municipality ? { name: municipality.name, state: municipality.state } : null
            }
            showSearch={false}
          />
        </div>
      </div>

      <div
        className={`flex flex-col border border-urban-petrol/30 rounded-card bg-sidebar/80 transition-all duration-300 ${
          panelOpen ? 'w-72' : 'w-12'
        }`}
      >
        <div className="p-2 border-b border-white/10 flex items-center justify-between">
          {panelOpen && (
            <span className="flex items-center gap-2 text-urban-gray-light font-medium">
              <Route size={18} /> Detalhes da rota
            </span>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-gray-light flex-shrink-0"
            aria-label={panelOpen ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {panelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {panelOpen && (
          <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-3">
              <Link
                to="/roteirizacao"
                className="flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
              >
                <ArrowLeft size={16} /> Voltar à listagem
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/roteirizacao/${route.id}/editar`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
                >
                  <Pencil size={14} /> Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>

            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              route.status === 'active' ? 'bg-urban-green/20 text-urban-green' :
              route.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
              route.status === 'completed' ? 'bg-urban-green/20 text-urban-green' : 'bg-urban-gray-data/20 text-urban-gray-data'
            }`}>
              {STATUS_LABELS[route.status]}
            </span>

            <h1 className="text-lg font-semibold text-urban-gray-light">{route.name}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-urban-gray-data">
              <span>{municipality?.name ?? '-'}</span>
              <span>{shiftLabel(route.shift)}</span>
              <span>{route.totalStops} paradas</span>
              <span>{formatKm(route.estimatedKm)}</span>
              <span>{formatDuration(route.estimatedDuration)}</span>
            </div>

            <div className="rounded-lg bg-white/5 border border-urban-petrol/50 p-3 space-y-3">
              <div>
                <p className="text-urban-gray-data text-xs mb-0.5">Escola destino</p>
                {school ? (
                  <Link
                    to={`/escolas/${school.id}`}
                    className="text-urban-green hover:underline font-medium text-sm break-words"
                  >
                    {school.name}
                  </Link>
                ) : (
                  <p className="text-urban-gray-light text-sm">-</p>
                )}
              </div>
              <p className="text-sm text-urban-gray-light">
                <span className="text-urban-gray-data">Total de alunos vinculados:</span>{' '}
                <span className="font-semibold tabular-nums">{routeStudentsCount}</span>
              </p>
              <Link
                to={`/alunos?${new URLSearchParams({
                  routeId: route.id,
                  municipalityId: route.municipalityId,
                  schoolId: route.schoolId,
                }).toString()}`}
                className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium transition-colors"
              >
                <Users size={16} /> Ver alunos desta rota
              </Link>
            </div>

            <div className="rounded-lg bg-white/5 border border-urban-petrol/50 p-3 flex items-start gap-2">
              <Warehouse className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
              <div className="min-w-0">
                <p className="text-urban-gray-data text-xs">Garagem de origem</p>
                <p className="text-urban-gray-light text-sm font-medium truncate">{garage?.name ?? '—'}</p>
                {garage?.address && (
                  <p className="text-urban-gray-data text-xs truncate mt-0.5" title={garage.address}>{garage.address}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white/5 border border-urban-petrol/50 p-3">
              <h3 className="text-urban-gray-light font-medium text-sm mb-2 flex items-center gap-1.5">
                <MapPin size={16} /> Paradas (trajeto)
              </h3>
              <ol className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                <li className="text-urban-gray-data">Origem</li>
                {(route.stops ?? []).map((s) => (
                  <li key={s.id} className="text-urban-gray-light">
                    <span className="font-medium text-urban-green">{s.order}.</span>{' '}
                    {s.address || `Parada ${s.order}`}
                    {s.studentsIds?.length > 0 && (
                      <span className="text-urban-gray-data"> — {s.studentsIds.length} aluno(s)</span>
                    )}
                  </li>
                ))}
                <li className="text-urban-gray-data">Destino: {school?.name ?? '-'}</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        open={deleteModalOpen && isCustom}
        title={`Excluir a rota "${route.name}"?`}
        description="A rota será removida permanentemente. Esta ação não pode ser desfeita."
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleExcluir}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo…"
        confirmButtonClassName="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
      />
      <DeleteConfirmModal
        open={deleteModalOpen && !isCustom}
        title="Rota de demonstração"
        description="Esta rota não pode ser excluída. Use Editar para copiá-la e salvar como nova rota."
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={() => setDeleteModalOpen(false)}
        confirmLabel="Entendi"
        showCancel={false}
        confirmButtonClassName="px-4 py-2 rounded-lg bg-urban-green/25 text-urban-green hover:bg-urban-green/35 text-sm font-medium border border-urban-green/40 disabled:opacity-50"
      />
    </div>
  );
}
