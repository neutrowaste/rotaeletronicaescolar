import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  ClockAlert,
  MapPinned,
  ChevronLeft,
  ChevronRight,
  Bus,
  Wrench,
  Warehouse,
  Activity,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { Incident, Schedule } from '@rota-eletronica/shared-types';
import { shiftLabel } from '@rota-eletronica/shared-types';
import { useStudentsStore } from '@/store/studentsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useRoutesStore } from '@/store/routesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useSchedulesStore } from '@/store/schedulesStore';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole } from '@/utils/permissoes';
import { countEffectiveStudentsOnRoute } from '@/utils/routeStudentCount';

/** Data de hoje (America/Sao_Paulo), YYYY-MM-DD — alinhado ao monitoramento. */
function brTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Ex.: 2026-03-22 → 22/03/2026 */
function formatYmdToDdMmYyyy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

/** ISO da rota → texto curto em pt-BR (fuso São Paulo). */
function formatRouteTouchBr(iso: string | undefined): string {
  const s = (iso ?? '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

/** Ordenação “mais recente primeiro”: prioriza lastUpdated, senão createdAt. */
function routeRecencyTimestamp(r: { lastUpdated?: string; createdAt?: string }): number {
  const parse = (v: string | undefined) => {
    const t = Date.parse(v ?? '');
    return Number.isNaN(t) ? 0 : t;
  };
  const lu = parse(r.lastUpdated);
  if (lu > 0) return lu;
  return parse(r.createdAt);
}

/** Data da escala sempre como YYYY-MM-DD (corta ISO com hora, se vier). */
function scheduleDateYmd(dateStr: string | undefined): string {
  const s = (dateStr ?? '').trim();
  if (!s) return '';
  const head = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
}

function isScheduleStatusCompleted(status: string | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s === 'completed' || s === 'concluída' || s === 'concluida';
}

const DIAS_SEMANA_SEG_DOM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Avança/retrocede uma data civil YYYY-MM-DD no fuso America/Sao_Paulo. */
function addDaysYmdBr(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const anchor = new Date(`${iso}T12:00:00-03:00`);
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(anchor);
}

/** Segunda-feira e domingo (YYYY-MM-DD) da semana civil que contém `todayYmd`, fuso São Paulo. */
function weekMondaySundayYmdBr(todayYmd: string): { monday: string; sunday: string } {
  const wd = weekdaySegFirstIndexFromYmd(todayYmd);
  const monday = addDaysYmdBr(todayYmd, -wd);
  const sunday = addDaysYmdBr(monday, 6);
  return { monday, sunday };
}

/** Índice 0=Seg … 6=Dom para YYYY-MM-DD no fuso America/Sao_Paulo. */
function weekdaySegFirstIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).formatToParts(new Date(`${iso}T12:00:00-03:00`));
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const map: Record<string, number> = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };
  return map[wd ?? ''] ?? 0;
}

function nowMinutesInSaoPaulo(): number {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const min = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return h * 60 + min;
}

function isScheduleLateStart(s: Schedule): boolean {
  if (s.status !== 'scheduled') return false;
  const raw = s.startTime?.trim() ?? '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return false;
  const startMins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return nowMinutesInSaoPaulo() > startMins;
}

/** Status da escala de hoje para a rota (API); sem escala no dia = mensagem dedicada. */
function badgeEscalaHoje(sch: Schedule | undefined): { label: string; className: string } {
  if (!sch) {
    return {
      label: 'Sem escala cadastrada',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
  }
  const byStatus: Record<Schedule['status'], { label: string; className: string }> = {
    scheduled: {
      label: 'Agendada',
      className: 'bg-amber-50 text-amber-900 border border-amber-200',
    },
    in_progress: {
      label: 'Em andamento',
      className: 'bg-sky-100 text-sky-900 border border-sky-200',
    },
    completed: {
      label: 'Concluída',
      className: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
    },
    cancelled: {
      label: 'Cancelada',
      className: 'bg-gray-100 text-gray-600 border border-gray-200',
    },
  };
  return byStatus[sch.status] ?? {
    label: sch.status,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
}

function incidentIcon(type: Incident['type']) {
  if (type.startsWith('delay') || type === 'road_block') return ClockAlert;
  if (type === 'mechanical_failure') return Wrench;
  return AlertTriangle;
}

const INCIDENT_TYPE_LABEL: Partial<Record<Incident['type'], string>> = {
  delay_traffic: 'Atraso (trânsito)',
  delay_other: 'Atraso',
  mechanical_failure: 'Falha mecânica',
  accident: 'Acidente',
  road_block: 'Interdição',
  student_not_found: 'Aluno não localizado',
  student_issue: 'Ocorrência com aluno',
  other: 'Outro',
};

const cardClass = 'bg-sidebar/80 border border-urban-petrol/30 rounded-card shadow-sm';
/** Linhas por página no card de alertas (8+ conforme altura alinhada ao card ao lado). */
const ALERTS_PAGE_SIZE = 8;
/** Linhas por página na tabela Últimas rotas. */
const LAST_ROUTES_PAGE_SIZE = 3;
/** Atualização automática dos dados do dashboard (escalas/rotas/alunos) — ~45s. */
const DASHBOARD_REFRESH_MS = 45_000;

const btnMonitoramentoClass =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-urban-green bg-emerald-100 border border-emerald-200/90 hover:bg-emerald-200/90 transition-colors shadow-sm';

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  /** Usar `items` para o componente reagir quando o bootstrap preencher as listas (getX é referência estável no Zustand). */
  const students = useStudentsStore((s) => s.items);
  const vehicles = useVehiclesStore((s) => s.items);
  const routes = useRoutesStore((s) => s.items);
  const municipalities = useMunicipalitiesStore((s) => s.items);
  const schedules = useSchedulesStore((s) => s.items);
  const fetchVehicles = useVehiclesStore((s) => s.fetchVehicles);
  const fetchRoutes = useRoutesStore((s) => s.fetchRoutes);
  const fetchStudents = useStudentsStore((s) => s.fetchStudents);
  const fetchMunicipalities = useMunicipalitiesStore((s) => s.fetchMunicipalities);
  const fetchSchedules = useSchedulesStore((s) => s.fetchSchedules);
  const user = useAuthStore((s) => s.user);

  /**
   * Recarrega municípios, veículos, rotas, alunos e escalas em paralelo.
   * Antes as escalas vinham depois das rotas — status “hoje” e KPIs ficavam um passo atrasados.
   */
  const refreshDashboardData = useCallback(() => {
    void Promise.all([
      fetchMunicipalities({ silent: true }),
      fetchVehicles(undefined, { silent: true }),
      fetchRoutes(undefined, { silent: true }),
      fetchStudents(undefined, { silent: true }),
      fetchSchedules(undefined, { silent: true }),
    ]);
  }, [fetchMunicipalities, fetchVehicles, fetchRoutes, fetchStudents, fetchSchedules]);

  /** Montagem e cada navegação de volta ao dashboard (location.key). */
  useEffect(() => {
    refreshDashboardData();
  }, [refreshDashboardData, location.key]);

  /** Sem `useMemo([])`: “hoje” e a semana do gráfico precisam acompanhar o relógio (ex.: após meia-noite ou aba em segundo plano). */
  const todayYmd = brTodayYmd();
  const todayLabelBr = formatYmdToDdMmYyyy(todayYmd);

  /** Aba em segundo plano → volta a ficar visível: recarrega (evita só `focus`, que dispara em excesso). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      refreshDashboardData();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshDashboardData]);

  /** Atualização periódica enquanto o dashboard está aberto (aproxima “tempo real”). */
  useEffect(() => {
    const id = window.setInterval(() => refreshDashboardData(), DASHBOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshDashboardData]);
  /**
   * Municípios com status `active` no store.
   * ADMIN: todos os ativos retornados pela API.
   * GESTOR/OPERADOR: cruza com escopo do JWT quando existir; se o token não trouxer `municipioId`/`municipalityIds`
   * mas a listagem já veio filtrada pela API, usa os ativos do store (evita KPI 0 com 1 município visível no sistema).
   */
  const munActiveCount = useMemo(() => {
    const active = municipalities.filter((m) => m.status === 'active');
    if (user && isAdminRole(user.role)) {
      return active.length;
    }
    const scopeIds =
      user?.municipalityIds && user.municipalityIds.length > 0
        ? user.municipalityIds
        : user?.municipioId
          ? [user.municipioId]
          : [];
    if (scopeIds.length === 0) {
      return active.length;
    }
    const allowed = new Set(scopeIds);
    return active.filter((m) => allowed.has(m.id)).length;
  }, [municipalities, user]);

  const schedulesToday = useMemo(
    () => schedules.filter((s) => scheduleDateYmd(s.date) === todayYmd),
    [schedules, todayYmd]
  );

  const scheduleByRouteIdToday = useMemo(() => {
    const m = new Map<string, Schedule>();
    const priority = (st: string) => {
      if (st === 'in_progress') return 0;
      if (st === 'scheduled') return 1;
      if (isScheduleStatusCompleted(st)) return 2;
      return 3;
    };
    for (const sch of schedulesToday) {
      const cur = m.get(sch.routeId);
      if (!cur || priority(sch.status) < priority(cur.status)) m.set(sch.routeId, sch);
    }
    return m;
  }, [schedulesToday]);

  const rotasEmExecucao = useMemo(() => {
    const ids = new Set<string>();
    for (const s of schedulesToday) {
      if (s.status === 'in_progress') ids.add(s.routeId);
    }
    for (const r of routes) {
      if (r.status === 'in_progress') ids.add(r.id);
    }
    return ids.size;
  }, [schedulesToday, routes]);

  const rotasAtrasadas = useMemo(() => {
    const ids = new Set<string>();
    for (const s of schedulesToday) {
      if (s.status === 'scheduled' && isScheduleLateStart(s)) ids.add(s.routeId);
    }
    return ids.size;
  }, [schedulesToday]);

  const inOpVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of schedulesToday) {
      if (s.status === 'in_progress') ids.add(s.vehicleId);
    }
    return ids;
  }, [schedulesToday]);

  const vehicleSummary = useMemo(() => {
    const cadastrados = vehicles.length;
    const emManutencao = vehicles.filter((v) => v.status === 'maintenance').length;
    const emOperacao = vehicles.filter((v) => inOpVehicleIds.has(v.id)).length;
    const naGaragem = vehicles.filter((v) => {
      if (v.status === 'maintenance') return false;
      if (inOpVehicleIds.has(v.id)) return false;
      return v.status === 'active' || v.status === 'inactive';
    }).length;
    return { cadastrados, emOperacao, naGaragem, emManutencao };
  }, [vehicles, inOpVehicleIds]);

  /**
   * Semana civil (segunda a domingo, São Paulo): total geral e barras por dia da semana.
   * Para cada escala concluída, soma os alunos efetivos da rota (mesma regra de GET /routes).
   */
  const transportedWeekStats = useMemo(() => {
    const { monday, sunday } = weekMondaySundayYmdBr(todayYmd);
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const routeById = new Map(routes.map((r) => [r.id, r]));
    for (const sch of schedules) {
      if (!isScheduleStatusCompleted(sch.status)) continue;
      const dateYmd = scheduleDateYmd(sch.date);
      if (!dateYmd || dateYmd < monday || dateYmd > sunday) continue;
      const route = routeById.get(sch.routeId);
      if (!route) continue;
      const n = Math.max(countEffectiveStudentsOnRoute(route, students), route.totalStudents ?? 0);
      const idx = weekdaySegFirstIndexFromYmd(dateYmd);
      buckets[idx] += n;
    }
    const totalSemana = buckets.reduce((a, b) => a + b, 0);
    const chartStudentsByWeekday = DIAS_SEMANA_SEG_DOM.map((dia, i) => ({ dia, alunos: buckets[i] }));
    const periodLabel = `${formatYmdToDdMmYyyy(monday)} a ${formatYmdToDdMmYyyy(sunday)}`;
    return { totalSemana, chartStudentsByWeekday, periodLabel };
  }, [schedules, routes, students, todayYmd]);

  const alertsToday = useMemo(() => {
    const rows: {
      id: string;
      type: Incident['type'];
      description: string;
      registeredAt: string;
      routeId: string;
      scheduleName: string;
    }[] = [];
    for (const sch of schedulesToday) {
      for (const inc of sch.incidents ?? []) {
        if (inc.status === 'active') {
          rows.push({
            id: inc.id,
            type: inc.type,
            description: inc.description,
            registeredAt: inc.registeredAt,
            routeId: sch.routeId,
            scheduleName: sch.name,
          });
        }
      }
    }
    return rows.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }, [schedulesToday]);

  const [alertPage, setAlertPage] = useState(1);
  const alertTotalPages = Math.max(1, Math.ceil(alertsToday.length / ALERTS_PAGE_SIZE));
  const safeAlertPage = Math.min(alertPage, alertTotalPages);

  useEffect(() => {
    setAlertPage((p) => Math.min(p, alertTotalPages));
  }, [alertTotalPages]);
  const pagedAlerts = useMemo(() => {
    const start = (safeAlertPage - 1) * ALERTS_PAGE_SIZE;
    return alertsToday.slice(start, start + ALERTS_PAGE_SIZE);
  }, [alertsToday, safeAlertPage]);

  const routesSorted = useMemo(
    () =>
      [...routes].sort((a, b) => {
        const diff = routeRecencyTimestamp(b) - routeRecencyTimestamp(a);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
    [routes]
  );

  const [routesPage, setRoutesPage] = useState(1);
  const routesTotalPages = Math.max(1, Math.ceil(routesSorted.length / LAST_ROUTES_PAGE_SIZE));
  const safeRoutesPage = Math.min(routesPage, routesTotalPages);

  useEffect(() => {
    setRoutesPage((p) => Math.min(p, routesTotalPages));
  }, [routesTotalPages]);

  const pagedRoutes = useMemo(() => {
    const start = (safeRoutesPage - 1) * LAST_ROUTES_PAGE_SIZE;
    return routesSorted.slice(start, start + LAST_ROUTES_PAGE_SIZE);
  }, [routesSorted, safeRoutesPage]);

  const goMonitoring = () => {
    navigate('/mapa');
  };

  const kpis = [
    {
      label: 'Total de Alunos Cadastrados',
      value: String(students.length),
      icon: Users,
      accent: 'bg-[#0d394f]',
      iconWrap: 'bg-sky-50 text-[#0d394f]',
    },
    {
      label: 'Rotas em Execução',
      value: String(rotasEmExecucao),
      icon: Activity,
      accent: 'bg-urban-green',
      iconWrap: 'bg-emerald-50 text-urban-green',
    },
    {
      label: 'Rotas Atrasadas',
      value: String(rotasAtrasadas),
      icon: ClockAlert,
      accent: 'bg-amber-500',
      iconWrap: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Municípios Atendidos',
      value: String(munActiveCount),
      icon: MapPinned,
      accent: 'bg-[#134D5F]',
      iconWrap: 'bg-cyan-50 text-[#134D5F]',
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, accent, iconWrap }) => (
          <div key={label} className={`${cardClass} overflow-hidden flex flex-col`}>
            <div className="p-4 flex items-start gap-3 flex-1">
              <div className={`p-2.5 rounded-xl shrink-0 ${iconWrap}`}>
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-urban-gray-data leading-snug">{label}</p>
                <p className="text-2xl font-bold text-urban-gray-light tabular-nums mt-0.5">{value}</p>
              </div>
            </div>
            <div className={`h-1 w-full ${accent}`} aria-hidden />
          </div>
        ))}
      </div>

      {/* Alertas + gráfico analítico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-stretch">
        <div className="lg:col-span-7 flex">
          <div className={`${cardClass} p-4 flex flex-col flex-1 w-full min-h-0 lg:min-h-[260px]`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h2 className="text-base font-semibold text-urban-gray-light">Alertas do Dia</h2>
                <p className="text-xs text-urban-gray-data mt-0.5">
                  Ocorrências abertas nas escalas de hoje ({todayLabelBr})
                </p>
              </div>
              <button type="button" onClick={() => goMonitoring()} className={`${btnMonitoramentoClass} shrink-0`}>
                Ir para Monitoramento
                <ExternalLink size={14} />
              </button>
            </div>

            <div className="flex-1 min-h-[128px] max-h-[200px] border border-urban-petrol/15 rounded-lg overflow-y-auto flex flex-col">
              {pagedAlerts.length === 0 ? (
                <div className="min-h-[128px] flex flex-1 items-center justify-center text-xs text-urban-gray-data px-3 text-center">
                  Nenhum alerta registrado para hoje.
                </div>
              ) : (
                <ul className="divide-y divide-urban-petrol/10">
                  {pagedAlerts.map((a) => {
                    const Ic = incidentIcon(a.type);
                    return (
                      <li key={a.id} className="flex gap-2 px-2.5 py-1.5 items-start">
                        <Ic className="text-amber-600 shrink-0 mt-0.5" size={18} strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-urban-gray-data">
                            {INCIDENT_TYPE_LABEL[a.type] ?? a.type} · {a.scheduleName}
                          </p>
                          <p className="text-sm text-urban-gray-light line-clamp-2">{a.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-urban-petrol/10 text-xs text-urban-gray-data">
              <span>
                {alertsToday.length === 0 ? (
                  <>0 alertas</>
                ) : (
                  <>
                    Exibindo {(safeAlertPage - 1) * ALERTS_PAGE_SIZE + 1}–
                    {Math.min(safeAlertPage * ALERTS_PAGE_SIZE, alertsToday.length)} de {alertsToday.length} alerta
                    {alertsToday.length === 1 ? '' : 's'}
                  </>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeAlertPage <= 1}
                  onClick={() => setAlertPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-md border border-urban-petrol/20 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="tabular-nums px-2">
                  Página {safeAlertPage} de {alertTotalPages}
                </span>
                <button
                  type="button"
                  disabled={safeAlertPage >= alertTotalPages}
                  onClick={() => setAlertPage((p) => Math.min(alertTotalPages, p + 1))}
                  className="p-1 rounded-md border border-urban-petrol/20 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex">
          <div className={`${cardClass} p-4 flex flex-col flex-1 w-full min-h-0 lg:min-h-[260px]`}>
            <h2 className="text-base font-semibold text-urban-gray-light mb-0.5">Alunos transportados na semana</h2>
            <p className="text-xl font-bold text-urban-green tabular-nums leading-tight">{transportedWeekStats.totalSemana}</p>
            <p className="text-[11px] text-urban-gray-data mb-2 leading-snug">
              Total consolidado da semana (segunda a domingo) e distribuição diária de alunos no gráfico, considerando
              apenas rotas com escala concluída.
            </p>
            <div className="h-32 w-full shrink-0 min-h-[8rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transportedWeekStats.chartStudentsByWeekday} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0d394f22" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: '#5A7A72', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5A7A72', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #0d394f',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v} aluno(s)`, 'Transportados']}
                  />
                  <Bar dataKey="alunos" fill="#197c63" radius={[3, 3, 0, 0]} name="Alunos" maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-urban-gray-data mt-2 leading-snug border-t border-urban-petrol/10 pt-2">
              Período de: {transportedWeekStats.periodLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Últimas rotas + Veículos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-stretch">
        <div className="lg:col-span-7 flex">
          <div className={`${cardClass} p-4 flex flex-col flex-1 w-full min-h-0 lg:min-h-[260px]`}>
            <div className="mb-2">
              <h2 className="text-base font-semibold text-urban-gray-light">Últimas Rotas</h2>
              <p className="text-xs text-urban-gray-data mt-0.5">
                Ordem por última atualização da rota (data abaixo do nome). Status = escala de hoje ({todayLabelBr}).
                Sem registro nesta data: sem escala cadastrada.
              </p>
            </div>

            <div className="flex-1 min-h-[128px] max-h-[200px] overflow-y-auto rounded-lg border border-urban-petrol/15">
              {routesSorted.length === 0 ? (
                <div className="flex min-h-[128px] items-center justify-center px-3 text-center text-xs text-urban-gray-data">
                  Nenhuma rota cadastrada.
                </div>
              ) : (
                <table className="w-full min-w-0 border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] bg-white shadow-[0_1px_0_0_rgb(13_57_79/0.12)]">
                    <tr className="text-left text-urban-gray-data">
                      <th className="align-middle px-2.5 py-2 pr-2 font-medium">Rota</th>
                      <th className="align-middle py-2 pr-2 font-medium">Município</th>
                      <th className="align-middle py-2 pr-2 font-medium">Turno</th>
                      <th className="align-middle py-2 pr-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRoutes.map((r) => {
                      const sch = scheduleByRouteIdToday.get(r.id);
                      const badge = badgeEscalaHoje(sch);
                      const munName = municipalities.find((m) => m.id === r.municipalityId)?.name ?? '—';
                      const touch =
                        formatRouteTouchBr(r.lastUpdated) || formatRouteTouchBr(r.createdAt);
                      return (
                        <tr key={r.id} className="border-b border-urban-petrol/10 last:border-0">
                          <td className="align-middle px-2.5 py-2 pr-2 leading-snug text-urban-gray-light">
                            <div className="font-medium">{r.name}</div>
                            {touch ? (
                              <div className="text-[11px] text-urban-gray-data mt-0.5 font-normal">
                                Atual.: {touch}
                              </div>
                            ) : null}
                          </td>
                          <td className="align-middle py-2 pr-2 leading-snug text-urban-gray-data">{munName}</td>
                          <td className="align-middle py-2 pr-2 leading-snug text-urban-gray-data">
                            {shiftLabel(r.shift)}
                          </td>
                          <td className="align-middle py-2 pr-2.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-urban-petrol/10 text-xs text-urban-gray-data">
              <span>
                {routesSorted.length === 0 ? (
                  <>0 rotas</>
                ) : (
                  <>
                    Exibindo {(safeRoutesPage - 1) * LAST_ROUTES_PAGE_SIZE + 1}–
                    {Math.min(safeRoutesPage * LAST_ROUTES_PAGE_SIZE, routesSorted.length)} de {routesSorted.length} rota
                    {routesSorted.length === 1 ? '' : 's'}
                  </>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeRoutesPage <= 1}
                  onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-md border border-urban-petrol/20 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="tabular-nums px-2">
                  Página {safeRoutesPage} de {routesTotalPages}
                </span>
                <button
                  type="button"
                  disabled={safeRoutesPage >= routesTotalPages}
                  onClick={() => setRoutesPage((p) => Math.min(routesTotalPages, p + 1))}
                  className="p-1 rounded-md border border-urban-petrol/20 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex">
          <div className={`${cardClass} p-4 flex flex-col flex-1 w-full min-h-0 lg:min-h-[260px]`}>
            <h2 className="text-base font-semibold text-urban-gray-light mb-2">Resumo dos Veículos</h2>
            <ul className="flex min-h-[128px] flex-1 flex-col justify-center divide-y divide-urban-petrol/10 overflow-hidden rounded-lg border border-urban-petrol/15">
              <li className="flex items-center gap-3 bg-white/50 px-3 py-2.5">
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-slate-50 p-2 text-[#0d394f]">
                  <Bus size={20} strokeWidth={1.75} className="shrink-0" />
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <p className="text-sm leading-snug text-urban-gray-data">Veículos Cadastrados</p>
                </div>
                <span className="flex shrink-0 items-center text-xl font-bold tabular-nums text-urban-gray-light">
                  {vehicleSummary.cadastrados}
                </span>
              </li>
              <li className="flex items-center gap-3 bg-white/50 px-3 py-2.5">
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-50 p-2 text-urban-green">
                  <Activity size={20} strokeWidth={1.75} className="shrink-0" />
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <p className="text-sm leading-snug text-urban-gray-data">Em Operação</p>
                </div>
                <span className="flex shrink-0 items-center text-xl font-bold tabular-nums text-urban-green">
                  {vehicleSummary.emOperacao}
                </span>
              </li>
              <li className="flex items-center gap-3 bg-white/50 px-3 py-2.5">
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-sky-50 p-2 text-[#134D5F]">
                  <Warehouse size={20} strokeWidth={1.75} className="shrink-0" />
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <p className="text-sm leading-snug text-urban-gray-data">Na Garagem</p>
                </div>
                <span className="flex shrink-0 items-center text-xl font-bold tabular-nums text-[#134D5F]">
                  {vehicleSummary.naGaragem}
                </span>
              </li>
              <li className="flex items-center gap-3 bg-white/50 px-3 py-2.5">
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-red-50 p-2 text-red-700/90">
                  <Wrench size={20} strokeWidth={1.75} className="shrink-0" />
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <p className="text-sm leading-snug text-urban-gray-data">Em Manutenção</p>
                </div>
                <span className="flex shrink-0 items-center text-xl font-bold tabular-nums text-red-800/90">
                  {vehicleSummary.emManutencao}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
