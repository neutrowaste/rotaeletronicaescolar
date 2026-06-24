import type { Incident } from '@rota-eletronica/shared-types';

/** 10 intercorrências mockadas */
export const incidents: Incident[] = [
  { id: 'INC001', routeId: 'ROT001', scheduleId: 'SCHED001', type: 'delay_traffic', description: 'Trânsito intenso na Av. Norte Sul', estimatedDelay: 15, location: { lat: -22.9089, lng: -47.0620 }, registeredAt: '2026-03-10T07:15:00.000Z', resolvedAt: '2026-03-10T07:35:00.000Z', status: 'resolved' },
  { id: 'INC002', routeId: 'ROT002', scheduleId: 'SCHED002', type: 'delay_other', description: 'Obra na via principal', estimatedDelay: 10, location: { lat: -23.5010, lng: -47.4520 }, registeredAt: '2026-03-10T13:20:00.000Z', status: 'active' },
  { id: 'INC003', routeId: 'ROT003', scheduleId: 'SCHED003', type: 'student_not_found', description: 'Aluno não encontrado no ponto', location: { lat: -23.1850, lng: -46.8975 }, registeredAt: '2026-03-09T07:45:00.000Z', resolvedAt: '2026-03-09T08:00:00.000Z', status: 'resolved' },
  { id: 'INC004', routeId: 'ROT004', scheduleId: 'SCHED004', type: 'mechanical_failure', description: 'Problema no sistema de portas', estimatedDelay: 25, location: { lat: -21.1770, lng: -47.8098 }, registeredAt: '2026-03-08T06:30:00.000Z', resolvedAt: '2026-03-08T07:00:00.000Z', status: 'resolved' },
  { id: 'INC005', routeId: 'ROT005', scheduleId: 'SCHED005', type: 'road_block', description: 'Bloqueio temporário por acidente', estimatedDelay: 20, location: { lat: -23.1890, lng: -45.8835 }, registeredAt: '2026-03-10T06:50:00.000Z', status: 'active' },
  { id: 'INC006', routeId: 'ROT006', scheduleId: 'SCHED006', type: 'student_issue', description: 'Mal-estar de aluno durante o trajeto', estimatedDelay: 5, location: { lat: -22.3140, lng: -49.0600 }, registeredAt: '2026-03-07T12:15:00.000Z', resolvedAt: '2026-03-07T12:25:00.000Z', status: 'resolved' },
  { id: 'INC007', routeId: 'ROT007', scheduleId: 'SCHED007', type: 'delay_traffic', description: 'Congestionamento no retorno', estimatedDelay: 18, location: { lat: -23.6635, lng: -46.5318 }, registeredAt: '2026-03-10T17:00:00.000Z', status: 'active' },
  { id: 'INC008', routeId: 'ROT008', scheduleId: 'SCHED008', type: 'other', description: 'Chuva forte reduziu visibilidade', estimatedDelay: 8, location: { lat: -22.7250, lng: -47.6488 }, registeredAt: '2026-03-09T07:10:00.000Z', resolvedAt: '2026-03-09T07:25:00.000Z', status: 'resolved' },
  { id: 'INC009', routeId: 'ROT009', scheduleId: 'SCHED009', type: 'accident', description: 'Colisão leve - sem feridos', estimatedDelay: 45, location: { lat: -20.8190, lng: -49.3788 }, registeredAt: '2026-03-06T07:30:00.000Z', resolvedAt: '2026-03-06T08:30:00.000Z', status: 'resolved' },
  { id: 'INC010', routeId: 'ROT010', scheduleId: 'SCHED010', type: 'delay_other', description: 'Rota adiantada - previsão de chegada 07h20', estimatedDelay: -10, location: { lat: -21.2080, lng: -50.4322 }, registeredAt: '2026-03-10T06:45:00.000Z', status: 'resolved' },
];
