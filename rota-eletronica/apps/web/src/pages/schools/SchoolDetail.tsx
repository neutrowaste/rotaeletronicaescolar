import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, User, MapPin, Phone, Pencil, Trash2, Map } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useStudentsStore } from '@/store/studentsStore';
import { useMapFiltersStore } from '@/store/mapFiltersStore';
import { getStudentCountForSchool } from '@/utils/schoolCounts';
const STATUS_LABELS: Record<string, string> = { active: 'Ativa', inactive: 'Inativa' };
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
};

export function SchoolDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const getSchoolById = useSchoolsStore((s) => s.getSchoolById);
  const removeSchool = useSchoolsStore((s) => s.removeSchool);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const students = useStudentsStore((s) => s.getStudents)();
  const school = id ? getSchoolById(id) : undefined;
  const municipality = school ? municipalitiesList.find((m) => m.id === school.municipalityId) : undefined;
  const totalStudents = school ? getStudentCountForSchool(school.id, students) : 0;
  const setFiltersFromRecord = useMapFiltersStore((s) => s.setFiltersFromRecord);

  if (!school) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Escola não encontrada.{' '}
        <Link to="/escolas" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  const confirmarExcluir = () => {
    if (!id || !school) return;
    removeSchool(id);
    toast.success('Escola excluída.');
    setExcluirAberto(false);
    navigate('/escolas');
  };

  return (
    <div className="space-y-4">
      <Link to="/escolas" className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green">
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          to={`/escolas/editar/${id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </Link>
        <button
          type="button"
          onClick={() => {
            setFiltersFromRecord({ municipalityId: school.municipalityId, schoolId: school.id });
            navigate('/mapa');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Map size={14} /> Ver no mapa
        </button>
        <button
          type="button"
          onClick={() => setExcluirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-urban-green/20 flex items-center justify-center">
              <GraduationCap className="text-urban-green" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-urban-gray-light">{school.name}</h1>
              <p className="text-sm text-urban-gray-data">{municipality?.name ?? '-'}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[school.status] ?? ''}`}>
            {STATUS_LABELS[school.status] ?? school.status}
          </span>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2 sm:col-span-2">
            <MapPin className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Endereço</p>
              <p className="text-urban-gray-light text-sm font-medium">{school.address}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <User className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Diretor(a)</p>
              <p className="text-urban-gray-light text-sm font-medium">{school.principal}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3 flex items-start gap-2">
            <Phone className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-urban-gray-data text-xs mb-1">Telefone</p>
              <p className="text-urban-gray-light text-sm font-medium">{school.phone}</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Total de alunos</p>
            <p className="text-urban-gray-light text-sm font-medium">{totalStudents}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-urban-petrol/30 p-3">
            <p className="text-urban-gray-data text-xs mb-1">Coordenadas</p>
            <p className="text-urban-gray-light text-sm font-medium">
              {school.coordinates.lat.toFixed(6)}, {school.coordinates.lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir a escola "${school.name}"?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
