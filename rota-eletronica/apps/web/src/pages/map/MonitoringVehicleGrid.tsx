import type { MonitoringVehicleRow } from '@rota-eletronica/shared-types';

function formatLocationAt(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}

export function MonitoringVehicleGrid({
  rows,
  loading,
  referenceDate,
}: {
  rows: MonitoringVehicleRow[];
  loading: boolean;
  referenceDate: string;
}) {
  return (
    <div className="rounded-card border border-urban-petrol/30 bg-sidebar/80 overflow-hidden flex flex-col max-h-[min(42vh,520px)] min-h-0">
      <div className="px-4 py-3 border-b border-urban-petrol/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-base font-semibold text-urban-gray-light">Frota — monitoramento</h3>
          <p className="text-xs text-urban-gray-data mt-0.5">
            Veículos do(s) município(s) do seu perfil. Escala do dia atual (America/Sao_Paulo). Localização e paradas quando o app do motorista enviar dados.
          </p>
        </div>
        {referenceDate && (
          <span className="text-xs text-urban-gray-data whitespace-nowrap">Dia: {referenceDate}</span>
        )}
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-urban-gray-data">Carregando grade...</div>
      ) : (
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-left text-urban-gray-data border-b border-urban-petrol/30 bg-white/5 sticky top-0 z-[1]">
                <th className="px-3 py-2 font-medium">Veículo</th>
                <th className="px-3 py-2 font-medium">Status veículo</th>
                <th className="px-3 py-2 font-medium">Última localização</th>
                <th className="px-3 py-2 font-medium">Rota (hoje)</th>
                <th className="px-3 py-2 font-medium">Motorista</th>
                <th className="px-3 py-2 font-medium">Status rota</th>
                <th className="px-3 py-2 font-medium">Hora início</th>
                <th className="px-3 py-2 font-medium">Último ponto</th>
                <th className="px-3 py-2 font-medium">Próximo ponto</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-urban-gray-data">
                    Nenhum veículo no escopo do seu perfil.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.vehicleId} className="border-b border-urban-petrol/15 text-urban-gray-light hover:bg-white/5">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {r.brand} {r.model}{' '}
                      <span className="text-urban-gray-data font-normal">({r.plate})</span>
                    </td>
                    <td className="px-3 py-2">{r.vehicleStatusLabel}</td>
                    <td className="px-3 py-2 text-xs text-urban-gray-data max-w-[200px]">
                      {formatLocationAt(r.lastLocationAt)}
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate" title={r.routeName ?? ''}>
                      {r.routeName ?? '—'}
                    </td>
                    <td className="px-3 py-2">{r.driverName ?? '—'}</td>
                    <td className="px-3 py-2">{r.scheduleStatusLabel ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.startTime ?? '—'}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-xs" title={r.lastStopLabel}>
                      {r.lastStopLabel}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-xs" title={r.nextStopLabel}>
                      {r.nextStopLabel}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
