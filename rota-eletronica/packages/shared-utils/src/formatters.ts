/**
 * Formatadores de data, hora e números
 */

/** Formata data para exibição DD/MM/YYYY */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Formata hora HH:MM */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Formata data e hora DD/MM/YYYY HH:MM */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Formata número com separador de milhar (ex: 1.247) */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** Formata distância em km (ex: 32,4 km) */
export function formatKm(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/** Formata duração em minutos para "Xh Ymin" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}
