import type { StopOptionWithDistance } from '@/services/stopsService';
import { formatStopDistance } from '@/services/stopsService';
import { incompleteCardClass } from '@/utils/studentCompleteness';
import type { StudentIncompleteField } from '@/utils/studentCompleteness';
import { INCOMPLETE_EMPTY_BOX_HIGHLIGHT } from '@/utils/studentCompleteness';

type Props = {
  options: StopOptionWithDistance[];
  selectedKey: string;
  onSelect: (key: string) => void;
  schoolName?: string;
  shiftLabelText: string;
  emptyWhenNoMunicipality: string;
  emptyWhenNoSchool: string;
  emptyWhenNoStops: string;
  hasMunicipality: boolean;
  hasSchool: boolean;
  highlightIncomplete?: boolean;
  incomplete?: Set<StudentIncompleteField>;
};

export function BoardingStopOptionsPicker({
  options,
  selectedKey,
  onSelect,
  schoolName,
  shiftLabelText,
  emptyWhenNoMunicipality,
  emptyWhenNoSchool,
  emptyWhenNoStops,
  hasMunicipality,
  hasSchool,
  highlightIncomplete = false,
  incomplete,
}: Props) {
  const emptyClass =
    highlightIncomplete && incomplete?.has('boardingPoint')
      ? INCOMPLETE_EMPTY_BOX_HIGHLIGHT
      : 'border-urban-petrol/30 bg-white/5';

  if (options.length === 0) {
    const message = !hasMunicipality
      ? emptyWhenNoMunicipality
      : !hasSchool
        ? emptyWhenNoSchool
        : emptyWhenNoStops;
    return (
      <div className={`rounded-lg border px-3 py-3 text-sm text-urban-gray-data ${emptyClass}`}>
        {message}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2" role="radiogroup" aria-label="Opções de parada e rota">
        {options.map((stop, index) => {
          const selected = selectedKey === stop.key;
          const cardBase = incomplete
            ? incompleteCardClass(
                'rounded-lg border px-3 py-3 text-sm cursor-pointer transition-colors',
                'boardingPoint',
                incomplete
              )
            : 'rounded-lg border px-3 py-3 text-sm cursor-pointer transition-colors';
          return (
            <label
              key={stop.key}
              className={`${cardBase} block ${
                selected
                  ? 'border-urban-green bg-urban-green/10 ring-1 ring-urban-green/40'
                  : 'border-urban-petrol/30 bg-white/5 hover:border-urban-petrol/50'
              }`}
            >
              <div className="flex gap-3 items-start">
                <input
                  type="radio"
                  name="boardingStopOption"
                  value={stop.key}
                  checked={selected}
                  onChange={() => onSelect(stop.key)}
                  className="mt-1 accent-urban-green"
                />
                <div className="flex-1 space-y-1 text-urban-gray-light">
                  <p className="font-medium text-urban-green">
                    Opção {index + 1}
                    {index === 0 ? ' — mais próxima' : ''}
                  </p>
                  <p>
                    <span className="text-urban-gray-data">Rota: </span>
                    {stop.routeName ?? 'Não informada'}
                  </p>
                  {stop.itineraryStopOrder != null ? (
                    <p>
                      <span className="text-urban-gray-data">Ponto no itinerário: </span>
                      <span className="font-medium text-urban-green">{stop.itineraryStopOrder}</span>
                    </p>
                  ) : null}
                  <p>
                    <span className="text-urban-gray-data">Endereço da parada: </span>
                    {stop.address || '—'}
                  </p>
                  <p className="text-xs text-urban-gray-data">{formatStopDistance(stop.distanceMeters)}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-urban-gray-data mt-2">
        Até 3 opções das rotas da escola {schoolName ? `«${schoolName}»` : '—'} no turno {shiftLabelText}, do
        ponto mais próximo ao mais distante da casa do aluno. Escolha a melhor para este aluno.
      </p>
    </>
  );
}
