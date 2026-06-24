import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function ScheduleResumo() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-4">
      <Link to={id ? `/escalas/${id}` : '/escalas'} className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green">
        <ArrowLeft size={16} /> Voltar ao detalhe da escala
      </Link>
      <div className="rounded-card border border-urban-petrol/30 bg-sidebar/80 p-8 text-center">
        <FileText className="mx-auto text-urban-green mb-3" size={48} />
        <h2 className="text-lg font-semibold text-urban-gray-light mb-2">Resumo da rota</h2>
        <p className="text-urban-gray-data text-sm">Histórico e resumo desta escala estarão disponíveis em breve.</p>
      </div>
    </div>
  );
}
