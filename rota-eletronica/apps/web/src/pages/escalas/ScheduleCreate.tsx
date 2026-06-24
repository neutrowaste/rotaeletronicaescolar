import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import {
  expandDatesForFrequencyWeek,
  expandDatesInPeriod,
  hasScheduleConflict,
} from '@/utils/scheduleConflict';
import { driverSelectLabel, isDriverSelectableForSchedule } from '@/utils/driverSelect';
import {
  vehicleSelectLabel,
  isVehicleSelectableForSchedule,
  vehiclesForSchedule,
  hasActiveVehicleInPool,
} from '@/utils/vehicleSelect';

const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';
const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function ScheduleCreate() {
  const navigate = useNavigate();
  const addSchedule = useSchedulesStore((s) => s.addSchedule);
  const getSchedules = useSchedulesStore((s) => s.getSchedules);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const getDrivers = useDriversStore((s) => s.getDrivers);
  const getVehicles = useVehiclesStore((s) => s.getVehicles);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const schoolsList = useSchoolsStore((s) => s.getSchools)();
  const routesList = getRoutes();
  const driversList = getDrivers();
  const vehiclesList = getVehicles();
  const getGarageById = useGaragesStore((s) => s.getGarageById);

  const [name, setName] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [date, setDate] = useState('');
  /** `frequency` = uma escala por dia marcado na mesma semana; `date` = avulsa ou período com recorrência */
  const [dateMode, setDateMode] = useState<'frequency' | 'date'>('date');
  const [frequencyWeekdays, setFrequencyWeekdays] = useState<number[]>([]);
  const [usePeriodRecurrence, setUsePeriodRecurrence] = useState(false);
  const [periodEnd, setPeriodEnd] = useState('');
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);
  const [shift, setShift] = useState<ShiftPeriod>('morning');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('08:30');

  const schoolsInMunicipality = useMemo(
    () => (municipalityId ? schoolsList.filter((s) => s.municipalityId === municipalityId) : []),
    [schoolsList, municipalityId]
  );

  const routesInMunicipality = useMemo(
    () => (municipalityId ? routesList.filter((r) => r.municipalityId === municipalityId) : []),
    [routesList, municipalityId]
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
    if (selectedRoute) {
      setVehicleId((prev) => (vehiclesForSelect.some((v) => v.id === prev) ? prev : ''));
      setDriverId((prev) => (driversInMun.some((d) => d.id === prev) ? prev : ''));
      const ns = normalizeShiftToPeriod(selectedRoute.shift);
      setShift(ns);
      if (ns === 'morning') setStartTime('06:00'), setEndTime('08:30');
      else if (ns === 'afternoon') setStartTime('12:00'), setEndTime('14:30');
      else setStartTime('07:00'), setEndTime('17:00');
    } else {
      setVehicleId('');
      setDriverId('');
    }
  }, [selectedRoute, selectedRoute?.shift, vehiclesForSelect, driversInMun]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        toast.error(
          'Esta rota não possui garagem de origem. Edite a rota na roteirização e informe a garagem antes de criar a escala.'
        );
      }
      return;
    }
    if (!hasActiveVehicleInPool(vehiclesForSelect)) {
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
      toast.error(dateMode === 'frequency' ? 'Informe a data de referência da semana.' : 'Informe a data.');
      return;
    }
    if (dateMode === 'frequency') {
      if (frequencyWeekdays.length === 0) {
        toast.error('Selecione ao menos um dia da semana.');
        return;
      }
    } else if (usePeriodRecurrence) {
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

    try {
      const schoolSuffix = selectedSchool?.name ? ` (${selectedSchool.name})` : '';
      const baseName = name.trim() || `Escala ${selectedRoute.name}${schoolSuffix}`;

      let datesToCreate: string[] = [];
      if (dateMode === 'frequency') {
        datesToCreate = expandDatesForFrequencyWeek(date, frequencyWeekdays);
      } else if (!usePeriodRecurrence) {
        datesToCreate = [date];
      } else {
        datesToCreate = expandDatesInPeriod(date, periodEnd, recurringWeekdays);
      }
      datesToCreate = [...new Set(datesToCreate)].sort();

      let scheduleSnapshot = [...getSchedules()];
      let skippedDuplicates = 0;
      let createdCount = 0;

      for (const itemDate of datesToCreate) {
        if (hasScheduleConflict(scheduleSnapshot, routeId, itemDate, shift)) {
          skippedDuplicates += 1;
          continue;
        }
        const scheduleKind: Schedule['scheduleKind'] = dateMode === 'frequency' ? 'frequency' : 'data';
        const schedule: Omit<Schedule, 'id'> = {
          name: baseName,
          routeId,
          vehicleId,
          driverId,
          date: itemDate,
          shift,
          status: 'scheduled',
          startTime,
          endTime,
          scheduleKind,
          incidents: [],
        };
        const created = await addSchedule(schedule);
        scheduleSnapshot = [...scheduleSnapshot, created];
        createdCount += 1;
      }

      if (createdCount === 0) {
        toast.error(
          skippedDuplicates > 0
            ? datesToCreate.length <= 1
              ? 'Já existe uma escala nesta data para esta rota e turno.'
              : 'Nenhuma escala nova: todas as datas já existem para esta rota e turno.'
            : 'Não foi possível cadastrar a escala.'
        );
        return;
      }

      const multi = createdCount > 1;
      toast.success(
        multi && skippedDuplicates > 0
          ? `${createdCount} escala(s) cadastrada(s). ${skippedDuplicates} data(s) ignorada(s) por já existirem.`
          : multi
            ? `${createdCount} escalas cadastradas.`
            : 'Escala cadastrada.'
      );
      navigate('/escalas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar escala.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/escalas" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Nova Escala</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome da escala</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Escala Rota Norte (Escola Djalma)"
              className={inputClass}
            />
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
                Rota sem garagem cadastrada: exibindo veículos do município. Atualize a rota na roteirização.
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
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className={inputClass}
              required
              disabled={!routeId}
            >
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
          <div className="sm:col-span-2 rounded-lg border border-urban-petrol/30 bg-white/[0.03] p-4 space-y-4">
            <p className="text-sm font-medium text-urban-gray-light">Data e frequência</p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer">
                <input
                  type="radio"
                  name="scheduleDateMode"
                  checked={dateMode === 'frequency'}
                  onChange={() => {
                    setDateMode('frequency');
                    setUsePeriodRecurrence(false);
                    setPeriodEnd('');
                    setRecurringWeekdays([]);
                  }}
                  className="text-urban-green focus:ring-urban-green border-urban-petrol/50"
                />
                Frequência (dias da semana)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-urban-gray-light cursor-pointer">
                <input
                  type="radio"
                  name="scheduleDateMode"
                  checked={dateMode === 'date'}
                  onChange={() => {
                    setDateMode('date');
                    setFrequencyWeekdays([]);
                  }}
                  className="text-urban-green focus:ring-urban-green border-urban-petrol/50"
                />
                Data (avulsa ou período)
              </label>
            </div>

            {dateMode === 'frequency' && (
              <div className="space-y-3">
                <p className="text-xs text-urban-gray-data">
                  Escolha a <strong className="text-urban-gray-light">semana de referência</strong> e os dias. Será criada{' '}
                  <strong className="text-urban-gray-light">uma escala por dia</strong> selecionado, todos na mesma semana
                  (segunda a domingo) que contém a data indicada.
                </p>
                <div>
                  <label className={labelClass}>Semana de referência *</label>
                  <DateInput value={date} onChange={setDate} className={inputClass} required />
                </div>
                <div>
                  <p className={labelClass}>Dias da semana *</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const checked = frequencyWeekdays.includes(day.value);
                      return (
                        <label key={day.value} className="inline-flex items-center gap-1.5 text-xs text-urban-gray-light cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setFrequencyWeekdays((prev) =>
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
              </div>
            )}

            {dateMode === 'date' && (
              <div className="space-y-3">
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
                      A data inicial deve ser um dos dias da semana marcados abaixo. Serão geradas escalas em todas as ocorrências
                      desses dias entre a data inicial e a final.
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
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Cadastrar escala</button>
          <Link to="/escalas" className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
