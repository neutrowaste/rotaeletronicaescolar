import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { MapContainer } from '@/components/maps/MapContainer';
import { MonitoringVehicleGrid } from '@/pages/map/MonitoringVehicleGrid';
import { useMapFiltersStore } from '@/store/mapFiltersStore';
import { useRoutesStore } from '@/store/routesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useAuthStore } from '@/store/authStore';
import { isGestorProfile } from '@/utils/authRole';
import { api } from '@/services/api';
import type { MonitoringVehicleRow, Route as RouteType, ShiftPeriod } from '@rota-eletronica/shared-types';
import { normalizeShiftToPeriod } from '@rota-eletronica/shared-types';
import { ufToEstadoNome } from '@/utils/brazilUfNames';

const ZOOM_1KM = 15;
/** Centro do Brasil para vista inicial do admin (filtro Todos) */
const BRAZIL_CENTER = { lat: -14.235, lng: -51.9253 };
const BRAZIL_ZOOM = 4;

const MONITORING_POLL_MS = 45_000;

export function MapPage() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [realRouteOnApplyId, setRealRouteOnApplyId] = useState('');
  const [appliedRouteDetail, setAppliedRouteDetail] = useState<RouteType | null>(null);
  const [monitoringRows, setMonitoringRows] = useState<MonitoringVehicleRow[]>([]);
  const [monitoringDate, setMonitoringDate] = useState('');
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const {
    municipalityId,
    routeId,
    shift,
    schoolId,
    setMunicipalityId,
    setRouteId,
    setShift,
    setSchoolId,
    clearFilters,
  } = useMapFiltersStore();
  const [draftMunicipalityId, setDraftMunicipalityId] = useState(municipalityId);
  const [draftRouteId, setDraftRouteId] = useState(routeId);
  const [draftShift, setDraftShift] = useState(shift);
  const [draftSchoolId, setDraftSchoolId] = useState(schoolId);
  const routes = useRoutesStore((s) => s.getRoutes());
  const schools = useSchoolsStore((s) => s.getSchools());
  const vehicles = useVehiclesStore((s) => s.getVehicles());
  const municipalities = useMunicipalitiesStore((s) => s.getMunicipalities());

  useEffect(() => {
    setDraftMunicipalityId(municipalityId);
    setDraftRouteId(routeId);
    setDraftShift(shift);
    setDraftSchoolId(schoolId);
  }, [municipalityId, routeId, shift, schoolId]);

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true);
    try {
      const res = await api.monitoring.vehicles();
      setMonitoringRows(res.data ?? []);
      setMonitoringDate(res.date ?? '');
    } catch {
      setMonitoringRows([]);
      setMonitoringDate('');
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonitoring();
    const id = window.setInterval(() => void loadMonitoring(), MONITORING_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadMonitoring]);

  const lastLocationByVehicleId = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const row of monitoringRows) {
      const loc = row.lastLocation;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        m.set(row.vehicleId, { lat: loc.lat, lng: loc.lng });
      }
    }
    return m;
  }, [monitoringRows]);

  const effectiveMunicipalityIds = useMemo((): string[] | undefined => {
    if (municipalityId) return [municipalityId];
    const ids = user?.municipalityIds;
    if (ids?.length) return ids;
    return undefined;
  }, [municipalityId, user?.municipalityIds]);

  const filteredRoutes = useMemo(() => {
    let list = [...routes];
    if (effectiveMunicipalityIds?.length) {
      list = list.filter((r) => effectiveMunicipalityIds.includes(r.municipalityId));
    }
    if (routeId) {
      list = list.filter((r) => r.id === routeId);
    }
    if (shift) {
      const want = normalizeShiftToPeriod(shift);
      list = list.filter((r) => normalizeShiftToPeriod(r.shift) === want);
    }
    if (schoolId) {
      list = list.filter((r) => r.schoolId === schoolId);
    }
    return list;
  }, [municipalityId, routeId, shift, schoolId, routes, effectiveMunicipalityIds]);

  const filteredSchools = useMemo(() => {
    const munIds = municipalityId
      ? [municipalityId]
      : effectiveMunicipalityIds ?? [...new Set(schools.map((s) => s.municipalityId))];
    let list = schools.filter((s) => munIds.includes(s.municipalityId));
    if (schoolId) {
      list = list.filter((s) => s.id === schoolId);
    } else if (routeId || shift) {
      const schoolIdsFromRoutes = new Set(filteredRoutes.map((r) => r.schoolId));
      list = list.filter((s) => schoolIdsFromRoutes.has(s.id));
    }
    return list;
  }, [municipalityId, routeId, shift, schoolId, schools, effectiveMunicipalityIds, filteredRoutes]);

  const appliedRouteForRealMode = useMemo(
    () => (realRouteOnApplyId ? filteredRoutes.find((r) => r.id === realRouteOnApplyId) : undefined),
    [realRouteOnApplyId, filteredRoutes]
  );

  const mapRoutes = useMemo(
    () => {
      if (appliedRouteDetail && realRouteOnApplyId && appliedRouteDetail.id === realRouteOnApplyId) {
        return [appliedRouteDetail];
      }
      return appliedRouteForRealMode ? [appliedRouteForRealMode] : filteredRoutes;
    },
    [appliedRouteDetail, realRouteOnApplyId, appliedRouteForRealMode, filteredRoutes]
  );

  const mapSchools = useMemo(() => {
    if (!appliedRouteForRealMode) return filteredSchools;
    return filteredSchools.filter((s) => s.id === appliedRouteForRealMode.schoolId);
  }, [appliedRouteForRealMode, filteredSchools]);

  const singleMunicipalityView = useMemo(
    () => (municipalityId ? true : (effectiveMunicipalityIds?.length ?? 0) === 1),
    [municipalityId, effectiveMunicipalityIds]
  );

  const selectedMunicipality = useMemo(
    () => (municipalityId ? municipalities.find((m) => m.id === municipalityId) : null),
    [municipalityId, municipalities]
  );
  const municipalityForGeocode = useMemo(
    () =>
      selectedMunicipality
        ? { name: selectedMunicipality.name, state: selectedMunicipality.state }
        : null,
    [selectedMunicipality?.id, selectedMunicipality?.name, selectedMunicipality?.state]
  );

  const routesInMunicipality = useMemo(() => {
    let list = routes;
    if (effectiveMunicipalityIds?.length) {
      list = list.filter((r) => effectiveMunicipalityIds.includes(r.municipalityId));
    }
    if (draftMunicipalityId) {
      list = list.filter((r) => r.municipalityId === draftMunicipalityId);
    }
    if (draftSchoolId) {
      list = list.filter((r) => r.schoolId === draftSchoolId);
    }
    if (draftShift) {
      const want = normalizeShiftToPeriod(draftShift);
      list = list.filter((r) => normalizeShiftToPeriod(r.shift) === want);
    }
    return list;
  }, [routes, effectiveMunicipalityIds, draftMunicipalityId, draftSchoolId, draftShift]);

  const availableShifts = useMemo(() => {
    let list = routes;
    if (effectiveMunicipalityIds?.length) {
      list = list.filter((r) => effectiveMunicipalityIds.includes(r.municipalityId));
    }
    if (draftMunicipalityId) {
      list = list.filter((r) => r.municipalityId === draftMunicipalityId);
    }
    if (draftSchoolId) {
      list = list.filter((r) => r.schoolId === draftSchoolId);
    }
    return new Set(list.map((r) => normalizeShiftToPeriod(r.shift)));
  }, [routes, effectiveMunicipalityIds, draftMunicipalityId, draftSchoolId]);

  const schoolsInMunicipality = useMemo(() => {
    let list = schools;
    if (effectiveMunicipalityIds?.length) {
      list = list.filter((s) => effectiveMunicipalityIds.includes(s.municipalityId));
    }
    if (draftMunicipalityId) {
      list = list.filter((s) => s.municipalityId === draftMunicipalityId);
    }
    return list;
  }, [schools, effectiveMunicipalityIds, draftMunicipalityId]);

  const vehiclePositions = useMemo(() => {
    return mapRoutes
      .flatMap((route) => {
        const v = vehicles.find((ve) => ve.id === route.vehicleId);
        if (!v) return [];
        const last = lastLocationByVehicleId.get(v.id);
        const lat = last?.lat ?? route.origin.lat;
        const lng = last?.lng ?? route.origin.lng;
        return [{ vehicle: v, lat, lng }];
      })
      .filter((v, i, arr) => arr.findIndex((x) => x.vehicle.id === v.vehicle.id) === i);
  }, [mapRoutes, vehicles, lastLocationByVehicleId]);

  /** Gestor/admin com filtro Todos: mapa abre no Brasil. Demais perfis com Todos: mapa centralizado no estado cadastrado no perfil. */
  const defaultCenter = isGestorProfile(user?.role) ? BRAZIL_CENTER : undefined;
  const defaultZoom = isGestorProfile(user?.role) ? BRAZIL_ZOOM : undefined;
  const initialStateView = useMemo(() => {
    if (isGestorProfile(user?.role) || municipalityId || !user?.municipalityIds?.length) return null;
    const firstId = user.municipalityIds[0];
    const mun = municipalities.find((m) => m.id === firstId);
    if (!mun?.state) return null;
    return ufToEstadoNome(mun.state) || mun.state;
  }, [user?.role, user?.municipalityIds, municipalityId, municipalities]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 min-h-0">
      <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
        <div className="flex-1 min-h-[320px] flex flex-col rounded-card overflow-hidden border border-urban-petrol/30">
          <div className="flex-1 min-h-0 w-full relative">
            <MapContainer
              key={`map-${municipalityId}-${routeId}-${schoolId}-${shift}`}
              filteredRoutes={mapRoutes}
              filteredSchools={mapSchools}
              vehiclePositions={vehiclePositions}
              zoomTo1kmWhenSingleMun={singleMunicipalityView}
              zoom1kmLevel={ZOOM_1KM}
              municipalityForGeocode={municipalityForGeocode}
              defaultCenter={defaultCenter}
              defaultZoom={defaultZoom}
              initialStateView={initialStateView}
              initialBrazilView={isGestorProfile(user?.role)}
              singleRouteMode={!!realRouteOnApplyId && !!appliedRouteForRealMode}
            />
          </div>
        </div>
        <MonitoringVehicleGrid
          rows={monitoringRows}
          loading={monitoringLoading}
          referenceDate={monitoringDate}
        />
      </div>

      <div
        className={`flex flex-col border border-urban-petrol/30 rounded-card bg-sidebar/80 transition-all duration-300 ${
          panelOpen ? 'w-72' : 'w-12'
        }`}
      >
        <div className="p-2 border-b border-white/10 flex items-center justify-between">
          {panelOpen && (
            <span className="flex items-center gap-2 text-urban-gray-light font-medium">
              <Filter size={18} /> Filtros
            </span>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-1.5 rounded hover:bg-white/10 text-urban-gray-data hover:text-urban-gray-light"
            aria-label={panelOpen ? 'Recolher filtros' : 'Expandir filtros'}
          >
            {panelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {panelOpen && (
          <div className="p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-urban-gray-data mb-1">Município</label>
              <select
                value={draftMunicipalityId}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftMunicipalityId(value);
                  setDraftRouteId('');
                  setDraftSchoolId('');
                  setRealRouteOnApplyId('');
                  setAppliedRouteDetail(null);
                  setMunicipalityId(value);
                  setRouteId('');
                  setSchoolId('');
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              >
                <option value="">Todos</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-urban-gray-data mb-1">Escola</label>
              <select
                value={draftSchoolId}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftSchoolId(value);
                  setRealRouteOnApplyId('');
                  setAppliedRouteDetail(null);
                  setSchoolId(value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              >
                <option value="">Todas</option>
                {schoolsInMunicipality.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-urban-gray-data mb-1">Turno</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'morning', label: 'Manhã' },
                  { value: 'afternoon', label: 'Tarde' },
                  { value: 'integral', label: 'Integral' },
                ].map(({ value, label }) => {
                  const disabled =
                    value !== '' &&
                    !availableShifts.has(value as ShiftPeriod);
                  return (
                    <span
                      key={value || 'all'}
                      title={disabled ? 'Não há rota para este turno com os filtros atuais.' : undefined}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setDraftShift(value);
                          setRealRouteOnApplyId('');
                          setAppliedRouteDetail(null);
                          setShift(value);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          disabled
                            ? 'bg-white/5 text-urban-gray-data cursor-not-allowed'
                            :
                          draftShift === value
                            ? 'bg-urban-green text-white'
                            : 'bg-white/10 text-urban-gray-light hover:bg-white/15'
                        }`}
                      >
                        {label}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-urban-gray-data mb-1">Rota</label>
              <select
                value={draftRouteId}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftRouteId(value);
                  setRealRouteOnApplyId('');
                  setAppliedRouteDetail(null);
                  setRouteId(value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              >
                <option value="">Todas</option>
                {routesInMunicipality.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                clearFilters();
                setDraftMunicipalityId('');
                setDraftRouteId('');
                setDraftShift('');
                setDraftSchoolId('');
                setRealRouteOnApplyId('');
                setAppliedRouteDetail(null);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/15 text-sm font-medium"
            >
              <X size={16} /> Limpar filtros
            </button>

            <button
              type="button"
              onClick={async () => {
                setMunicipalityId(draftMunicipalityId);
                setRouteId(draftRouteId);
                setShift(draftShift);
                setSchoolId(draftSchoolId);

                const selectedRouteId =
                  draftRouteId || (filteredRoutes.length === 1 ? filteredRoutes[0].id : '');

                if (!selectedRouteId) {
                  setRealRouteOnApplyId('');
                  setAppliedRouteDetail(null);
                  return;
                }

                setRealRouteOnApplyId(selectedRouteId);
                try {
                  const full = (await api.routes.get(selectedRouteId)) as RouteType;
                  setAppliedRouteDetail(full);
                } catch {
                  setAppliedRouteDetail(null);
                }
              }}
              className="w-full py-2 rounded-lg bg-urban-green text-white font-medium text-sm hover:bg-urban-green-medium transition-colors"
            >
              Aplicar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
