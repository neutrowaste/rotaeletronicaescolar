import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSchedulesStore } from '@/store/schedulesStore';
import { useRoutesStore } from '@/store/routesStore';
import { useDriversStore } from '@/store/driversStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useGaragesStore } from '@/store/garagesStore';
import { DateInput } from '@/components/forms/DateInput';
import type { Schedule, ShiftPeriod } from '@rota-eletronica/shared-types';
import { SHIFT_SELECT_OPTIONS, normalizeShiftToPeriod } from '@rota-eletronica/shared-types';
import { expandDatesInPeriod, hasScheduleConflict, normalizeScheduleDate } from '@/utils/scheduleConflict';
import { driverSelectLabel, isDriverSelectableForSchedule } from '@/utils/driverSelect';
import {
  vehicleSelectLabel,
  isVehicleSelectableForSchedule,
  vehiclesForSchedule,
  hasActiveVehicleInPool,
} from '@/utils/vehicleSelect';

const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';
const STATUS_OPTIONS = [
  { value: 'scheduled' as const, label: 'Agendada' },
  { value: 'in_progress' as const, label: 'Em andamento' },
  { value: 'completed' as const, label: 'Concluída' },
  { value: 'cancelled' as const, label: 'Cancelada' },
];
const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function ScheduleEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getScheduleById = useSchedulesStore((s) => s.getScheduleById);
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule);
  const addSchedule = useSchedulesStore((s) => s.addSchedule);
  const getSchedules = useSchedulesStore((s) => s.getSchedules);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const getDrivers = useDriversStore((s) => s.getDrivers);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const schoolsList = useSchoolsStore((s) => s.getSchools)();
  const schedule = id ? getScheduleById(id) : undefined;
  const routesList = getRoutes();
  const driversList = getDrivers();
  const vehiclesList = getVehicles();
  const getGarageById = useGaragesStore((s) => s.getGarageById);

  const [municipalityId, setMunicipalityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [date, setDate] = useState('');
  const [shift, setShift] = useState<ShiftPeriod>('morning');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('08:30');
  const [status, setStatus] = useState<Schedule['status']>('scheduled');
  const [name, setName] = useState('');
  const [usePeriodRecurrence, setUsePeriodRecurrence] = useState(false);
  const [periodEnd, setPeriodEnd] = useState('');
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);

  const routesInMunicipality = useMemo(
    () => (municipalityId ? routesList.filter((r) => r.municipalityId === municipalityId) : []),
    [routesList, municipalityId]
  );
  const schoolsInMunicipality = useMemo(
    () => (municipalityId ? schoolsList.filter((s) => s.municipalityId === municipalityId) : []),
    [schoolsList, municipalityId]
  );
  const routesInSchool = useMemo(
    () => (schoolId ? routesInMunicipality.filter((r) => r.schoolId === schoolId) : []),
    [routesInMunicipality, schoolId]
  );
  const selectedRoute = useMemo(() => routesInSchool.find((r) => r.id === routeId), [routesInSchool, routeId]);
  const selectedSchool = useMemo(
    () => (schoolId ? schoolsList.find((s) => s.id === schoolId) : undefined),
    [schoolId, schoolsList]
  );
  const vehiclePool = useMemo(
    () =>
      vehiclesForSchedule(vehiclesList, selectedRoute, (id) => getGarageById(id)?.name),
    [selectedRoute, vehiclesList, getGarageById]
  );
  const { vehicles: vehiclesForSelect, legacyNoGarage, garageName } = vehiclePool;
  const selectedVehicle = useMemo(
    () => (vehicleId ? vehiclesList.find((v) => v.id === vehicleId) : undefined),
    [vehicleId, vehiclesList]
  );
  const driversInMun = useMemo(
    () => (selectedRoute ? driversList.filter((d) => d.municipalityIds?.includes(selectedRoute.municipalityId)) : []),
    [selectedRoute, driversList]
  );
  const selectedDriver = useMemo(
    () => (driverId ? driversInMun.find((d) => d.id === driverId) : undefined),
    [driverId, driversInMun]
  );

  useEffect(() => {
    if (schedule) {
      const scheduleRoute = routesList.find((r) => r.id === schedule.routeId);
      setMunicipalityId(scheduleRoute?.municipalityId ?? '');
      setSchoolId(scheduleRoute?.schoolId ?? '');
      setRouteId(schedule.routeId);
      setVehicleId(schedule.vehicleId);
      setDriverId(schedule.driverId);
      setDate(schedule.date);
      setShift(normalizeShiftToPeriod(schedule.shift));
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setStatus(schedule.status);
      setName(schedule.name);
    }
  }, [schedule, routesList]);

  useEffect(() => {
    if (selectedRoute && routeId) {
      setVehicleId((prev) => (vehiclesForSelect.some((v) => v.id === prev) ? prev : ''));
      setDriverId((prev) => (driversInMun.some((d) => d.id === prev) ? prev : ''));
    }
  }, [selectedRoute?.id, routeId, vehiclesForSelect, driversInMun]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !schedule) return;
    if (!municipalityId) {
      toast.error('Selecione o município.');
      return;
    }
    if (!routeId || !selectedRoute) {
      toast.error('Selecione a rota.');
      return;
    }
    if (vehiclesForSelect.length === 0) {
      if (selectedRoute.garageId) {
        toast.error(
          garageName
            ? `Não há veículos cadastrados na garagem "${garageName}".`
            : 'Não há veículos cadastrados na garagem de origem desta rota.'
        );
      } else {
        toast.error('Esta rota não possui garagem de origem. Atualize a rota na roteirização.');
      }
      return;
    }
    if (
      !hasActiveVehicleInPool(vehiclesForSelect) &&
      !(selectedVehicle && isVehicleSelectableForSchedule(selectedVehicle, vehicleId))
    ) {
      toast.error(
        garageName
          ? `Não há veículos ativos na garagem "${garageName}". Ative ou cadastre um veículo ativo para escalar.`
          : 'Não há veículos ativos na garagem de origem desta rota.'
      );
      return;
    }
    if (!vehicleId) {
      toast.error('Selecione o veículo.');
      return;
    }
    if (selectedVehicle && !isVehicleSelectableForSchedule(selectedVehicle, vehicleId)) {
      toast.error('Selecione um veículo ativo. Veículos em manutenção ou inativos não podem ser escalados.');
      return;
    }
    if (!driverId) {
      toast.error('Selecione o motorista.');
      return;
    }
    if (selectedDriver && selectedDriver.status !== 'active') {
      toast.error('Selecione um motorista ativo. Motoristas inativos não podem ser vinculados à escala.');
      return;
    }
    if (!date) {
      toast.error('Informe a data.');
      return;
    }
    if (usePeriodRecurrence) {
      if (!periodEnd) {
        toast.error('Informe a data final do período.');
        return;
      }
      if (date > periodEnd) {
        toast.error('A data inicial não pode ser posterior à data final.');
        return;
      }
      if (recurringWeekdays.length === 0) {
        toast.error('Selecione ao menos um dia da semana para a recorrência.');
        return;
      }
      const startD = new Date(`${date}T12:00:00`);
      if (!recurringWeekdays.includes(startD.getDay())) {
        toast.error('A data inicial deve cair em um dos dias da semana selecionados.');
        return;
      }
    }
    if (!startTime || !endTime) {
      toast.error('Informe horário de início e fim.');
      return;
    }

    const schoolSuffix = selectedSchool?.name ? ` (${selectedSchool.name})` : '';
    const updatedName = name.trim() || `Escala ${selectedRoute.name}${schoolSuffix}`;
    const updated: Schedule = {
      ...schedule,
      name: updatedName,
      routeId,
      vehicleId,
      driverId,
      date,
      shift,
      status,
      startTime,
      endTime,
    };
    try {
      await updateSchedule(updated);

      if (usePeriodRecurrence) {
        const allInPeriod = expandDatesInPeriod(date, periodEnd, recurringWeekdays);
        const nd = normalizeScheduleDate(date);
        const toCreate = allInPeriod.filter((d) => normalizeScheduleDate(d) !== nd);

        let scheduleSnapshot = [...getSchedules().filter((s) => s.id !== id), updated];
        let skippedDuplicates = 0;
        let createdRecurring = 0;
        for (const nextDate of toCreate) {
          if (hasScheduleConflict(scheduleSnapshot, routeId, nextDate, shift, id)) {
            skippedDuplicates += 1;
            continue;
          }
          const newRow = await addSchedule({
            name: updatedName,
            routeId,
            vehicleId,
            driverId,
            date: nextDate,
            shift,
            status,
            startTime,
            endTime,
            incidents: [],
          });
          scheduleSnapshot = [...scheduleSnapshot, newRow];
          createdRecurring += 1;
        }
        toast.success(
          skippedDuplicates > 0 && createdRecurring === 0
            ? 'Escala atualizada. Nenhuma escala extra criada (datas já existentes para esta rota e turno).'
            : skippedDuplicates > 0
              ? `Escala atualizada. ${createdRecurring} escala(s) extra(s) criada(s). ${skippedDuplicates} data(s) ignorada(s) por já existirem.`
              : createdRecurring > 0
                ? `Escala atualizada. ${createdRecurring} escala(s) extra(s) criada(s) no período.`
                : 'Escala atualizada.'
        );
      } else {
        toast.success('Escala atualizada.');
      }
      navigate(`/escalas/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar escala.');
    }
  };

  if (!schedule) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Escala não encontrada. <Link to="/escalas" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/escalas" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Editar Escala</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Escala Rota X - 2025-03-15" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Município *</label>
            <select
              value={municipalityId}
              onChange={(e) => {
                setMunicipalityId(e.target.value);
                setSchoolId('');
                setRouteId('');
                setVehicleId('');
                setDriverId('');
              }}
              className={inputClass}
              required
            >
              <option value="">Selecione o município</option>
              {municipalitiesList.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Escola *</label>
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                setRouteId('');
                setVehicleId('');
                setDriverId('');
              }}
              className={inputClass}
              required
              disabled={!municipalityId}
            >
              <option value="">Selecione a escola</option>
              {schoolsInMunicipality.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Rota *</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className={inputClass} required disabled={!schoolId}>
              <option value="">Selecione a rota</option>
              {routesInSchool.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Veículo *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={inputClass}
              required
              disabled={!routeId || vehiclesForSelect.length === 0}
            >
              <option value="">
                {vehiclesForSelect.length === 0 ? 'Nenhum veículo disponível' : 'Selecione'}
              </option>
              {vehiclesForSelect.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  disabled={!isVehicleSelectableForSchedule(v, vehicleId)}
                >
                  {vehicleSelectLabel(v)}
                </option>
              ))}
            </select>
            {routeId && legacyNoGarage && (
              <p className="mt-1 text-xs text-amber-400/90">
                Rota sem garagem cadastrada: exibindo veículos do município.
              </p>
            )}
            {routeId && !legacyNoGarage && garageName && (
              <p className="mt-1 text-xs text-urban-gray-data">
                Veículos da garagem: {garageName}
                {vehiclesForSelect.length === 0 && ' — nenhum veículo cadastrado nesta garagem.'}
                {vehiclesForSelect.length > 0 && !hasActiveVehicleInPool(vehiclesForSelect) && ' — nenhum veículo ativo no momento.'}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Motorista *</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={inputClass} required disabled={!routeId}>
              <option value="">Selecione</option>
              {driversInMun.map((d) => (
                <option
                  key={d.id}
                  value={d.id}
                  disabled={!isDriverSelectableForSchedule(d, driverId)}
                >
                  {driverSelectLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 rounded-lg border border-urban-petrol/30 bg-white/[0.03] p-4 space-y-3">
            <p className="text-sm font-medium text-urban-gray-light">Data</p>
            <div>
              <label className={labelClass}>{usePeriodRecurrence ? 'Data inicial *' : 'Data da escala *'}</label>
              <DateInput value={date} onChange={setDate} className={inputClass} required />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer">
              <input
                type="checkbox"
                checked={usePeriodRecurrence}
                onChange={(e) => {
                  setUsePeriodRecurrence(e.target.checked);
                  if (!e.target.checked) {
                    setPeriodEnd('');
                    setRecurringWeekdays([]);
                  }
                }}
                className="rounded border-urban-petrol/50 bg-white/5 text-urban-green focus:ring-urban-green"
              />
              Repetir em um período (recorrência)
            </label>
            {usePeriodRecurrence && (
              <>
                <div>
                  <label className={labelClass}>Data final do período *</label>
                  <DateInput value={periodEnd} onChange={setPeriodEnd} className={inputClass} required />
                </div>
                <p className="text-xs text-urban-gray-data">
                  A data inicial deve ser um dos dias da semana marcados. Escalas extras serão criadas para as demais datas do período
                  (a escala atual corresponde à data inicial).
                </p>
                <div>
                  <p className={labelClass}>Dias da semana *</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const checked = recurringWeekdays.includes(day.value);
                      return (
                        <label key={day.value} className="inline-flex items-center gap-1.5 text-xs text-urban-gray-light cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setRecurringWeekdays((prev) =>
                                e.target.checked ? [...prev, day.value] : prev.filter((d) => d !== day.value)
                              );
                            }}
                            className="rounded border-urban-petrol/50 bg-white/5 text-urban-green focus:ring-urban-green"
                          />
                          {day.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <label className={labelClass}>Turno</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as ShiftPeriod)} className={inputClass}>
              {SHIFT_SELECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Horário início *</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Horário fim *</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Schedule['status'])} className={inputClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Salvar alterações</button>
          <Link to={`/escalas/${id}`} className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
