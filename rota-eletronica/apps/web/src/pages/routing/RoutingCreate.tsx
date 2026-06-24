import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, MapPin, Check, X, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoutesStore } from '@/store/routesStore';
import { useSchedulesStore } from '@/store/schedulesStore';
import { useAuthStore } from '@/store/authStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useGaragesStore } from '@/store/garagesStore';
import { computeThreeRouteOptions, computeRoute, buildComputeRouteParams, computeRouteWithDirectionsFallback, computeTwoRouteOptions, type RouteOption } from '@/services/routingService';
import { RouteCreateMap } from '@/components/maps/RouteCreateMap';
import type { Route, ShiftPeriod, Stop } from '@rota-eletronica/shared-types';
import { normalizeShiftToPeriod } from '@rota-eletronica/shared-types';
import { formatDuration, formatKm } from '@rota-eletronica/shared-utils';

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'integral', label: 'Integral' },
];

/** Centro (lat/lng) de cada município para direcionar e dar zoom no mapa */
const MUNICIPALITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  MUN001: { lat: -22.9056, lng: -47.0608 },   // Campinas
  MUN002: { lat: -23.5015, lng: -47.4582 },   // Sorocaba
  MUN003: { lat: -23.1857, lng: -46.8833 },   // Jundiaí
  MUN004: { lat: -21.1774, lng: -47.8102 },   // Ribeirão Preto
  MUN005: { lat: -23.1896, lng: -45.8845 },   // São José dos Campos
  MUN006: { lat: -22.3145, lng: -49.0604 },  // Bauru
  MUN007: { lat: -23.6639, lng: -46.5383 },  // Santo André
  MUN008: { lat: -22.7256, lng: -47.6493 },  // Piracicaba
  MUN009: { lat: -20.8197, lng: -49.3794 },   // São José do Rio Preto
  MUN010: { lat: -21.2089, lng: -49.9543 },   // Araçatuba
  MUN011: { lat: -22.2176, lng: -49.9502 },   // Marília
  MUN012: { lat: -22.1256, lng: -51.3889 },   // Presidente Prudente
};

function normalizeMunicipalityCenter(coordinates: unknown): { lat: number; lng: number } | null {
  if (!coordinates || typeof coordinates !== 'object') return null;
  const c = coordinates as { lat?: unknown; lng?: unknown };
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Reordena stops com base no índice otimizado retornado pela API */
function reorderStopsByOptimizedIndex(stops: Stop[], optimizedOrder: number[]): Stop[] {
  if (optimizedOrder.length !== stops.length) return stops;
  return optimizedOrder.map((originalIndex, newIndex) => ({
    ...stops[originalIndex],
    order: newIndex + 1,
  }));
}

export function RoutingCreate() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const isEditMode = Boolean(editId && pathname.includes('/editar'));
  const addRoute = useRoutesStore((s) => s.addRoute);
  const updateRoute = useRoutesStore((s) => s.updateRoute);
  const getRouteById = useRoutesStore((s) => s.getRouteById);
  const isCustomRoute = useRoutesStore((s) => s.isCustomRoute);
  const getSchedules = useSchedulesStore((s) => s.getSchedules);
  const user = useAuthStore((s) => s.user);
  const getGarages = useGaragesStore((s) => s.getGarages);
  const getGarageById = useGaragesStore((s) => s.getGarageById);
  const fetchGarages = useGaragesStore((s) => s.fetchGarages);
  const municipalities = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const schools = getSchools();
  const existingRoute = isEditMode && editId ? getRouteById(editId) : undefined;

  const [name, setName] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [shift, setShift] = useState<ShiftPeriod>('morning');
  const [schoolId, setSchoolId] = useState('');
  const [garageId, setGarageId] = useState('');
  const [observations, setObservations] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightedStopIndex, setHighlightedStopIndex] = useState<number | null>(null);

  /** Após otimização: ordem confirmada pelo usuário (ou null se ainda não confirmou) */
  const [confirmedResult, setConfirmedResult] = useState<{
    optimizedStops: Stop[];
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  /** Opções de rota no modal (1 = só mais rápido, 2 = mais rápido + vias principais) */
  const [routeOptionsForModal, setRouteOptionsForModal] = useState<RouteOption[] | null>(null);
  /** Índice da opção selecionada no modal (0 ou 1) */
  const [selectedRouteOptionIndex, setSelectedRouteOptionIndex] = useState(0);
  /** Key para forçar reanimação do mapa no modal ao clicar em Play */
  const [modalMapPlayKey, setModalMapPlayKey] = useState(0);
  /** Key para reproduzir animação da rota no mapa principal (editar rota, sem abrir modal) */
  const [mainMapPlayKey, setMainMapPlayKey] = useState(0);
  /** Ordem das paradas antes da otimização (para reverter ao cancelar o modal) */
  const [stopsBeforeOptimize, setStopsBeforeOptimize] = useState<Stop[] | null>(null);

  /** Modal de confirmação ao clicar no mapa para adicionar parada */
  const [addStopModalOpen, setAddStopModalOpen] = useState(false);
  const [pendingStop, setPendingStop] = useState<{ lat: number; lng: number; address: string } | null>(null);
  /** Modo "adicionar parada": só ao clicar no mapa adiciona parada quando true; senão mapa navega normalmente */
  const [addStopMode, setAddStopMode] = useState(false);

  const garage = useMemo(
    () => (garageId ? getGarageById(garageId) : null),
    [garageId, getGarageById]
  );
  const school = useMemo(
    () => (schoolId ? schools.find((sc) => sc.id === schoolId) : null),
    [schoolId, schools]
  );

  const schoolsInMun = useMemo(
    () => (municipalityId ? schools.filter((sc) => sc.municipalityId === municipalityId) : []),
    [municipalityId, schools]
  );
  const garagesInMun = useMemo(
    () => (municipalityId ? getGarages().filter((g) => g.municipalityId === municipalityId) : []),
    [municipalityId, getGarages]
  );

  useEffect(() => {
    if (municipalityId) void fetchGarages(municipalityId, { silent: true });
  }, [municipalityId, fetchGarages]);

  const displayStops = confirmedResult?.optimizedStops ?? stops;
  const displayPolyline = confirmedResult?.encodedPolyline ?? null;

  const prefillDoneRef = useRef(false);
  useEffect(() => {
    if (!isEditMode || !existingRoute || prefillDoneRef.current) return;
    prefillDoneRef.current = true;
    setName(existingRoute.name);
    setMunicipalityId(existingRoute.municipalityId);
    setShift(normalizeShiftToPeriod(existingRoute.shift));
    setSchoolId(existingRoute.schoolId);
    setGarageId(existingRoute.garageId ?? '');
    setStops(existingRoute.stops);
    setConfirmedResult({
      optimizedStops: existingRoute.stops,
      encodedPolyline: existingRoute.polyline,
      distanceMeters: existingRoute.estimatedKm * 1000,
      durationSeconds: existingRoute.estimatedDuration * 60,
    });
  }, [isEditMode, existingRoute]);
  useEffect(() => {
    if (!isEditMode) prefillDoneRef.current = false;
  }, [isEditMode]);

  const addStop = () => {
    setAddStopMode(true);
    toast('Clique no mapa no local desejado para adicionar a parada.', { icon: '📍' });
  };

  const selectedMunicipality = useMemo(
    () => (municipalityId ? municipalities.find((m) => m.id === municipalityId) ?? null : null),
    [municipalityId, municipalities]
  );
  const municipalityCenter = useMemo(() => {
    if (!municipalityId) return null;
    const fromMunicipality = normalizeMunicipalityCenter(selectedMunicipality?.coordinates);
    if (fromMunicipality) return fromMunicipality;
    return MUNICIPALITY_CENTERS[municipalityId] ?? null;
  }, [municipalityId, selectedMunicipality?.coordinates]);
  const municipalityForBounds = selectedMunicipality
    ? { name: selectedMunicipality.name, state: selectedMunicipality.state }
    : null;

  const onMapClickRequestStop = useCallback((lat: number, lng: number, address?: string) => {
    setPendingStop({ lat, lng, address: address ?? '' });
    setAddStopModalOpen(true);
  }, []);

  const confirmAddStop = useCallback(() => {
    if (!pendingStop) return;
    setStops((prev) => {
      const order = prev.length + 1;
      const stop: Stop = {
        id: `stop-${Date.now()}-${order}`,
        order,
        address: pendingStop.address,
        coordinates: { lat: pendingStop.lat, lng: pendingStop.lng },
        studentsIds: [],
        estimatedArrival: '07:00',
      };
      return [...prev, stop];
    });
    setConfirmedResult(null);
    setPendingStop(null);
    setAddStopModalOpen(false);
    toast.success('Parada adicionada.');
  }, [pendingStop]);

  const cancelAddStopModal = useCallback(() => {
    setAddStopModalOpen(false);
    setPendingStop(null);
  }, []);

  const removeStop = (id: string) => {
    setStops((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setConfirmedResult(null);
  };

  const handleOptimize = async () => {
    if (!garage?.coordinates) {
      toast.error('Selecione a garagem de origem.');
      return;
    }
    if (!school?.coordinates) {
      toast.error('Selecione a escola de destino.');
      return;
    }
    if (stops.length < 1) {
      toast.error('Adicione ao menos um ponto intermediário.');
      return;
    }

    setOptimizing(true);
    try {
      let options: RouteOption[] = await computeThreeRouteOptions(
        garage.coordinates,
        stops,
        school.coordinates
      );
      if (options.length === 0) {
        if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
          options = await computeTwoRouteOptions(window.google, garage.coordinates, stops, school.coordinates);
        }
        if (options.length === 0) {
          const result = await computeRouteWithDirectionsFallback(garage.coordinates, stops, school.coordinates)
            ?? await computeRoute(buildComputeRouteParams(garage.coordinates, stops, school.coordinates));
          if (result) options = [
            { label: 'Caminho mais rápido', result },
            { label: 'Opção 2 (alternativa)', result: { ...result } },
          ];
        }
      }

      if (options.length === 0) {
        toast.error('Não foi possível otimizar a rota. Verifique se a chave da API (Maps JavaScript API) está correta.');
        return;
      }

      toast.success(options.length >= 2
        ? 'Duas opções de rota disponíveis. Escolha e confirme no modal.'
        : 'Rota otimizada. Confirme no modal.');

      setStopsBeforeOptimize([...stops]);
      const firstResult = options[0].result;
      setStops(reorderStopsByOptimizedIndex(stops, firstResult.optimizedOrder));
      setRouteOptionsForModal(options);
      setSelectedRouteOptionIndex(0);
      setConfirmedResult(null);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao chamar a API de rotas.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleConfirmModal = () => {
    if (!routeOptionsForModal?.length) return;
    const selected = routeOptionsForModal[selectedRouteOptionIndex];
    const baseStops = stopsBeforeOptimize ?? stops;
    const optimizedStops = reorderStopsByOptimizedIndex(baseStops, selected.result.optimizedOrder);
    setConfirmedResult({
      optimizedStops,
      encodedPolyline: selected.result.encodedPolyline,
      distanceMeters: selected.result.distanceMeters,
      durationSeconds: selected.result.durationSeconds,
    });
    setStops(optimizedStops);
    setModalOpen(false);
    setRouteOptionsForModal(null);
    setHighlightedStopIndex(null);
  };

  const handleCancelModal = () => {
    setModalOpen(false);
    setConfirmedResult(null);
    setRouteOptionsForModal(null);
    setHighlightedStopIndex(null);
    if (stopsBeforeOptimize) {
      setStops(stopsBeforeOptimize);
      setStopsBeforeOptimize(null);
    }
  };

  const handleSave = async () => {
    if (!confirmedResult) {
      toast.error('Otimize a rota e confirme no modal antes de salvar.');
      return;
    }
    if (!name.trim()) {
      toast.error('Informe o nome da rota.');
      return;
    }
    if (!municipalityId || !schoolId || !garageId) {
      toast.error('Preencha município, garagem de origem e escola.');
      return;
    }
    if (!school || !garage) {
      toast.error('Dados da escola ou garagem não encontrados.');
      return;
    }

    const totalStudents = confirmedResult.optimizedStops.reduce(
      (acc, s) => acc + s.studentsIds.length,
      0
    );
    const now = new Date().toISOString();

    if (isEditMode && editId && isCustomRoute(editId)) {
      if (
        existingRoute?.garageId &&
        garage.id !== existingRoute.garageId &&
        getSchedules().some((s) => s.routeId === editId && s.status !== 'cancelled')
      ) {
        toast.error(
          'Não é possível alterar a garagem de origem: existem escalas vinculadas a esta rota.'
        );
        return;
      }
      try {
        await updateRoute(editId, {
          name: name.trim(),
          municipalityId,
          vehicleId: undefined,
          driverId: undefined,
          schoolId,
          garageId: garage.id,
          shift,
          totalStudents,
          totalStops: confirmedResult.optimizedStops.length,
          estimatedKm: Math.round((confirmedResult.distanceMeters / 1000) * 10) / 10,
          estimatedDuration: Math.round(confirmedResult.durationSeconds / 60),
          stops: confirmedResult.optimizedStops,
          polyline: confirmedResult.encodedPolyline,
          origin: garage.coordinates,
          lastUpdated: now,
          generatedAt: now,
        });
        toast.success('Rota atualizada.');
        navigate(`/roteirizacao/${editId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao atualizar rota.');
      }
      return;
    }

    const isCopyFromDemo = isEditMode && editId && !isCustomRoute(editId);

    const route: Omit<Route, 'id'> = {
      name: name.trim(),
      municipalityId,
      vehicleId: undefined,
      driverId: undefined,
      schoolId,
      garageId: garage.id,
      shift,
      totalStudents,
      totalStops: confirmedResult.optimizedStops.length,
      estimatedKm: Math.round((confirmedResult.distanceMeters / 1000) * 10) / 10,
      estimatedDuration: Math.round(confirmedResult.durationSeconds / 60),
      status: 'active',
      scheduleId: null,
      stops: confirmedResult.optimizedStops,
      polyline: confirmedResult.encodedPolyline,
      origin: garage.coordinates,
      createdAt: now,
      lastUpdated: now,
      generatedAt: now,
      createdBy: user?.id,
    };
    try {
      await addRoute(route);
      toast.success(isCopyFromDemo ? 'Rota de demonstração copiada e salva como nova.' : 'Rota salva.');
      navigate('/roteirizacao');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar rota.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Link
          to={isEditMode && editId ? `/roteirizacao/${editId}` : '/roteirizacao'}
          className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">
          {isEditMode ? 'Editar Rota' : 'Nova Rota'}
        </h1>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Coluna esquerda ~40%: configuração e paradas */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto">
          <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-4 space-y-3">
            <h2 className="text-urban-gray-light font-medium text-sm">Dados básicos</h2>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Nome da rota</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Rota Centro — Manhã"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Município</label>
              <select
                value={municipalityId}
                onChange={(e) => {
                  setMunicipalityId(e.target.value);
                  setSchoolId('');
                  setGarageId('');
                  setConfirmedResult(null);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              >
                <option value="">Selecione</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Turno</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftPeriod)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              >
                {SHIFT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Garagem de origem</label>
              <select
                value={garageId}
                onChange={(e) => {
                  setGarageId(e.target.value);
                  setConfirmedResult(null);
                }}
                disabled={!municipalityId}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green disabled:opacity-50"
              >
                <option value="">Selecione</option>
                {garagesInMun.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {garage && (
                <p className="mt-1 text-xs text-urban-gray-data truncate" title={garage.address}>
                  {garage.address}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Escola de destino</label>
              <select
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setConfirmedResult(null);
                }}
                disabled={!municipalityId}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green disabled:opacity-50"
              >
                <option value="">Selecione</option>
                {schoolsInMun.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-urban-gray-data mb-1">Observações</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
              />
            </div>
            <p className="text-xs text-urban-gray-data">Veículo e motorista serão definidos na criação da escala.</p>
          </div>

          <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-urban-gray-light font-medium text-sm flex items-center gap-1.5">
                  <MapPin size={16} /> Paradas
                </h2>
                <button
                  type="button"
                  onClick={addStop}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-xs font-medium"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <p className="text-xs text-urban-gray-data">
                {addStopMode ? (
                  <>Modo adicionar parada ativo — clique no mapa no local desejado. <button type="button" onClick={() => setAddStopMode(false)} className="text-urban-green underline">Sair do modo</button></>
                ) : (
                  'Clique em Adicionar e depois no mapa para colocar uma parada.'
                )}
              </p>
            </div>
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {displayStops.map((s, index) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    highlightedStopIndex === index ? 'bg-urban-green/20 ring-1 ring-urban-green/50' : 'bg-white/5 border border-urban-petrol/30 hover:bg-white/10'
                  }`}
                  onClick={() => setHighlightedStopIndex(index === highlightedStopIndex ? null : index)}
                >
                  <span className="text-urban-gray-data w-5 font-medium">{s.order}.</span>
                  <span className="flex-1 text-urban-gray-light truncate">
                    {s.address || `Parada ${s.order}`}
                  </span>
                  {!confirmedResult && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeStop(s.id); }}
                      className="p-1 rounded text-red-400 hover:bg-red-500/20"
                      aria-label="Remover parada"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {stops.length === 0 && (
              <p className="text-xs text-urban-gray-data">Nenhuma parada. Clique em Adicionar.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOptimize}
                disabled={optimizing || stops.length < 1 || !garageId || !schoolId || !garage}
                className="px-4 py-2 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {optimizing ? 'Otimizando...' : 'Otimizar rota'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!confirmedResult}
                className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar rota
              </button>
            </div>
            {displayPolyline && (
              <button
                type="button"
                onClick={() => setMainMapPlayKey((k) => k + 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 font-medium text-sm"
                title="Reproduzir animação da rota no mapa"
              >
                <Play size={18} /> Reproduzir rota
              </button>
            )}
          </div>
          {!confirmedResult && (
            <p className="text-xs text-urban-gray-data">
              Otimize a rota e confirme no modal para habilitar o salvamento.
            </p>
          )}
        </div>

        {/* Coluna direita ~60%: mapa */}
        <div className="lg:col-span-3 min-h-[320px] flex flex-col">
          <RouteCreateMap
            key={`main-map-${mainMapPlayKey}`}
            origin={garage?.coordinates ?? null}
            destination={school?.coordinates ?? null}
            stops={displayStops.map((s) => ({ id: s.id, order: s.order, coordinates: s.coordinates, address: s.address }))}
            encodedPolyline={displayPolyline}
            municipalityCenter={municipalityCenter}
            municipalityForBounds={municipalityForBounds}
            highlightedIndex={highlightedStopIndex}
            onStopClick={setHighlightedStopIndex}
            onMapClick={addStopMode ? onMapClickRequestStop : undefined}
            showSearch={true}
            animatePolyline={mainMapPlayKey > 0}
          />
        </div>
      </div>

      {/* Modal de confirmação ao adicionar parada pelo mapa */}
      {addStopModalOpen && pendingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={cancelAddStopModal}>
          <div
            className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-urban-gray-light mb-2">Confirmar parada</h3>
            <p className="text-xs text-urban-gray-data mb-3 line-clamp-3">
              {pendingStop.address || `Coordenadas: ${pendingStop.lat.toFixed(5)}, ${pendingStop.lng.toFixed(5)}`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelAddStopModal}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/15 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAddStop}
                className="px-3 py-1.5 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação da ordem otimizada — layout moderno: esq = itinerário, dir = mapa com rota animada */}
      {modalOpen && routeOptionsForModal && routeOptionsForModal.length > 0 && (() => {
        const selectedOption = routeOptionsForModal[selectedRouteOptionIndex];
        const baseStops = stopsBeforeOptimize ?? stops;
        const modalStops = reorderStopsByOptimizedIndex(baseStops, selectedOption.result.optimizedOrder);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={handleCancelModal}>
            <div
              className="rounded-2xl bg-[#1a2332] border border-urban-petrol/50 shadow-2xl w-full max-w-7xl max-h-[1500px] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-urban-petrol/30 flex-shrink-0">
                <h3 className="text-xl font-semibold text-white">Confirmar rota otimizada</h3>
                <p className="mt-1 text-sm text-urban-gray-data">
                  Escolha a opção desejada e confira o itinerário e a navegação no mapa.
                </p>
              </div>
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[35%_65%] gap-0">
                {/* Coluna esquerda: itinerário (ruas e sequência), texto branco */}
                <div className="flex flex-col border-r border-urban-petrol/30 bg-[#0f1620]/80 overflow-hidden">
                  <div className="p-5 overflow-y-auto flex-1">
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-urban-green uppercase tracking-wider">Origem</span>
                        <p className="text-white font-medium mt-0.5">{garage?.name ?? '—'}</p>
                      </div>
                      <div className="flex gap-6 py-2 text-sm border-b border-white/10">
                        <span className="text-white">
                          Distância: <strong className="text-urban-green">{formatKm(selectedOption.result.distanceMeters / 1000)}</strong>
                        </span>
                        <span className="text-white">
                          Tempo: <strong className="text-urban-green">{formatDuration(Math.round(selectedOption.result.durationSeconds / 60))}</strong>
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-urban-gray-data uppercase tracking-wider">Itinerário — ruas e sequência</span>
                        <ol className="mt-2 space-y-2">
                          {modalStops.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-3 text-white">
                              <span className="w-7 h-7 rounded-full bg-urban-green/40 text-urban-green flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-white">{s.address || `Parada ${s.order}`}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Destino</span>
                        <p className="text-white font-medium mt-0.5">{school?.name ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Coluna direita: botões Opção 1 / Opção 2 acima do mapa + mapa com pontos, rota e Play */}
                <div className="min-h-[320px] md:min-h-0 flex flex-col bg-[#0f1620]">
                  <div className="flex items-center justify-between gap-3 p-3 border-b border-urban-petrol/30 flex-shrink-0 flex-wrap">
                    <div className="flex flex-wrap gap-2">
                      {routeOptionsForModal.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedRouteOptionIndex(idx)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                            selectedRouteOptionIndex === idx
                              ? 'bg-urban-green text-white shadow-lg shadow-urban-green/30'
                              : 'bg-white/10 text-urban-gray-data hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalMapPlayKey((k) => k + 1)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-urban-green/90 hover:bg-urban-green text-white text-sm font-medium"
                      title="Reproduzir animação da rota"
                    >
                      <Play size={18} /> Reproduzir rota
                    </button>
                  </div>
                  <div className="flex-1 min-h-[280px] relative">
                    <RouteCreateMap
                      key={`modal-map-${selectedRouteOptionIndex}-${modalMapPlayKey}-${selectedOption.result.encodedPolyline.slice(0, 20)}`}
                      origin={garage?.coordinates ?? null}
                      destination={school?.coordinates ?? null}
                      stops={modalStops.map((s) => ({ id: s.id, order: s.order, coordinates: s.coordinates, address: s.address }))}
                      encodedPolyline={selectedOption.result.encodedPolyline}
                      municipalityCenter={null}
                      showSearch={false}
                      animatePolyline={true}
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-urban-petrol/30 flex gap-3 justify-end flex-shrink-0 bg-[#1a2332]">
                <button
                  type="button"
                  onClick={handleCancelModal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/15 font-medium"
                >
                  <X size={18} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmModal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-urban-green hover:bg-urban-green-medium text-white font-medium shadow-lg shadow-urban-green/20"
                >
                  <Check size={18} /> Confirmar rota
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
