import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Phone, Mail, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudentsStore } from '@/store/studentsStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StudentIncompleteBanner } from '@/components/students/StudentIncompleteBanner';
import { StudentIncompleteDetailLabel } from '@/components/students/StudentIncompleteDetailLabel';
import { formatStopDistance } from '@/services/stopsService';
import { shiftLabel } from '@rota-eletronica/shared-types';
import {
  displayValueOrDash,
  getStudentIncompleteFieldSet,
  getStudentIncompleteMessages,
  incompleteCardClass,
  incompleteDetailValueClass,
  incompleteSectionCardClass,
  INCOMPLETE_ALERT_ICON_CLASS,
  INCOMPLETE_PHOTO_FRAME,
  INCOMPLETE_TEXT_CLASS,
  isDashOrBlank,
  isResponsibleSectionIncomplete,
  type StudentIncompleteField,
} from '@/utils/studentCompleteness';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  transferred: 'Transferido',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-urban-green/20 text-urban-green',
  inactive: 'bg-urban-gray-data/20 text-urban-gray-data',
  transferred: 'bg-amber-500/20 text-amber-400',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const isoDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const fetchStudentById = useStudentsStore((s) => s.fetchStudentById);
  const removeStudent = useStudentsStore((s) => s.removeStudent);
  const getSchoolById = useSchoolsStore((s) => s.getSchoolById);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const student = useStudentsStore((s) => (id ? s.items.find((st) => st.id === id) : undefined));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void fetchStudentById(id).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, fetchStudentById]);
  const municipality = student ? municipalitiesList.find((m) => m.id === student.municipalityId) : undefined;
  const school = student ? getSchoolById(student.schoolId) : undefined;
  const incompleteMessages = useMemo(
    () => (student ? getStudentIncompleteMessages(student) : []),
    [student]
  );
  const incomplete = useMemo(
    () => (student ? getStudentIncompleteFieldSet(student) : new Set<StudentIncompleteField>()),
    [student]
  );
  const cardBase = 'rounded-lg bg-white/5 border border-urban-petrol/30 p-3';

  if (loading) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Carregando aluno…
      </div>
    );
  }

  if (!student) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Aluno não encontrado.{' '}
        <Link to="/alunos" className="text-urban-green hover:underline">
          Voltar à listagem
        </Link>
      </div>
    );
  }

  const r = student.responsible;

  const responsibleIncomplete = isResponsibleSectionIncomplete(incomplete);
  const valueBase = 'text-sm font-medium';
  const valueClass = (field: StudentIncompleteField) =>
    incompleteDetailValueClass(valueBase, field, incomplete);

  const confirmarExcluir = () => {
    if (!id || !student) return;
    removeStudent(id);
    toast.success('Aluno excluído.');
    setExcluirAberto(false);
    navigate('/alunos');
  };

  return (
    <div className="space-y-4">
      <Link
        to="/alunos"
        className="inline-flex items-center gap-2 text-sm text-urban-gray-data hover:text-urban-green"
      >
        <ArrowLeft size={16} /> Voltar à listagem
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to={`/alunos/editar/${id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-urban-green/20 text-urban-green hover:bg-urban-green/30 text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </Link>
        <button
          type="button"
          onClick={() => setExcluirAberto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>

      <StudentIncompleteBanner messages={incompleteMessages} />

      <div className="rounded-card border border-urban-petrol/30 overflow-hidden bg-sidebar/80">
        <div className="p-4 border-b border-urban-petrol/30 bg-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div
              className={`w-28 aspect-[3/4] rounded-lg overflow-hidden border-2 bg-white/5 flex-shrink-0 ${
                incomplete.has('photo') ? INCOMPLETE_PHOTO_FRAME : 'border-urban-petrol/50'
              }`}
            >
              <img
                src={student.photo}
                alt={student.name}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div>
              <h1
                className={`text-lg font-semibold flex items-center gap-1 ${
                  incomplete.has('name') ? INCOMPLETE_TEXT_CLASS : 'text-urban-gray-light'
                }`}
              >
                {incomplete.has('name') && <AlertTriangle size={16} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />}
                {displayValueOrDash(student.name)}
              </h1>
              <p className="text-sm flex flex-wrap items-center gap-x-1 text-urban-gray-data">
                <span
                  className={`inline-flex items-center gap-1 ${
                    incomplete.has('registrationNumber') ? INCOMPLETE_TEXT_CLASS : ''
                  }`}
                >
                  {incomplete.has('registrationNumber') && (
                    <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                  )}
                  Matrícula {displayValueOrDash(student.registrationNumber)}
                </span>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    incomplete.has('grade') ? INCOMPLETE_TEXT_CLASS : ''
                  }`}
                >
                  {incomplete.has('grade') && (
                    <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                  )}
                  {displayValueOrDash(student.grade)}
                </span>
                <span>• {shiftLabel(student.shift)}</span>
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[student.status] ?? ''}`}
          >
            {STATUS_LABELS[student.status] ?? student.status}
          </span>
        </div>

        <div className="p-4 grid gap-4 sm:grid-cols-2">
          <div className={incompleteCardClass(cardBase, 'birthDate', incomplete)}>
            <StudentIncompleteDetailLabel field="birthDate" incomplete={incomplete}>
              Data de nascimento
            </StudentIncompleteDetailLabel>
            <p className={valueClass('birthDate')}>{displayValueOrDash(formatDate(student.birthDate))}</p>
          </div>
          <div className={incompleteCardClass(cardBase, 'grade', incomplete)}>
            <StudentIncompleteDetailLabel field="grade" incomplete={incomplete}>
              Série
            </StudentIncompleteDetailLabel>
            <p className={valueClass('grade')}>{displayValueOrDash(student.grade)}</p>
          </div>
          <div className={incompleteCardClass(cardBase, 'schoolId', incomplete)}>
            <StudentIncompleteDetailLabel field="schoolId" incomplete={incomplete}>
              Escola
            </StudentIncompleteDetailLabel>
            <p className={valueClass('schoolId')}>{displayValueOrDash(school?.name)}</p>
          </div>
          <div className={incompleteCardClass(cardBase, 'municipalityId', incomplete)}>
            <StudentIncompleteDetailLabel field="municipalityId" incomplete={incomplete}>
              Município
            </StudentIncompleteDetailLabel>
            <p className={valueClass('municipalityId')}>{displayValueOrDash(municipality?.name)}</p>
          </div>
          <div className={`${incompleteCardClass(cardBase, 'address', incomplete)} sm:col-span-2`}>
            <StudentIncompleteDetailLabel field="address" incomplete={incomplete}>
              Endereço
            </StudentIncompleteDetailLabel>
            <p className={valueClass('address')}>{displayValueOrDash(student.address)}</p>
          </div>

          <div className={`${incompleteCardClass(cardBase, 'boardingPoint', incomplete)} flex items-start gap-2 sm:col-span-2`}>
            <MapPin className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0 space-y-1">
              <StudentIncompleteDetailLabel field="boardingPoint" incomplete={incomplete}>
                Parada (casa) — embarque (ida) e desembarque (volta)
              </StudentIncompleteDetailLabel>
              <p className={valueClass('boardingPoint')}>
                {displayValueOrDash(student.boardingPoint?.address)}
                {student.boardingPoint?.distanceMeters != null && (
                  <span className="text-urban-gray-data font-normal"> ({formatStopDistance(student.boardingPoint.distanceMeters)})</span>
                )}
              </p>
              <StudentIncompleteDetailLabel field="alightingPoint" incomplete={incomplete}>
                Escola — desembarque (chegada) e embarque (saída)
              </StudentIncompleteDetailLabel>
              <p className={valueClass('alightingPoint')}>{displayValueOrDash(student.alightingPoint?.address)}</p>
            </div>
          </div>

          <div
            className={`${incompleteSectionCardClass(cardBase, responsibleIncomplete)} flex items-start gap-2 sm:col-span-2`}
          >
            <User className="text-urban-green flex-shrink-0 mt-0.5" size={18} />
            <div className="min-w-0 space-y-1">
              <StudentIncompleteDetailLabel field="responsibleName" incomplete={incomplete}>
                Responsável
              </StudentIncompleteDetailLabel>
              <p className="text-sm font-medium flex flex-wrap items-center gap-x-1 text-urban-gray-light">
                {incomplete.has('responsibleName') && (
                  <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                )}
                <span className={incomplete.has('responsibleName') ? INCOMPLETE_TEXT_CLASS : undefined}>
                  {displayValueOrDash(r?.name)}
                </span>
                <span className="text-urban-gray-data">(</span>
                {incomplete.has('responsibleRelationship') && (
                  <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                )}
                <span className={incomplete.has('responsibleRelationship') ? INCOMPLETE_TEXT_CLASS : undefined}>
                  {displayValueOrDash(r?.relationship)}
                </span>
                <span className="text-urban-gray-data">)</span>
              </p>
              <p
                className={`text-xs flex items-center gap-1 ${
                  incomplete.has('responsiblePhone') ? INCOMPLETE_TEXT_CLASS : 'text-urban-gray-data'
                }`}
              >
                {incomplete.has('responsiblePhone') && (
                  <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                )}
                <Phone size={12} className="flex-shrink-0" aria-hidden />
                {displayValueOrDash(r?.phone)}
              </p>
              <p
                className={`text-xs flex items-center gap-1 ${
                  incomplete.has('responsibleEmail') ? INCOMPLETE_TEXT_CLASS : 'text-urban-gray-data'
                }`}
              >
                {incomplete.has('responsibleEmail') && (
                  <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                )}
                <Mail size={12} className="flex-shrink-0" aria-hidden />
                {displayValueOrDash(r?.email)}
              </p>
              <p
                className={`text-xs flex items-center gap-1 ${
                  incomplete.has('responsibleCpf') ? INCOMPLETE_TEXT_CLASS : 'text-urban-gray-data'
                }`}
              >
                {incomplete.has('responsibleCpf') && (
                  <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />
                )}
                CPF:{' '}
                {isDashOrBlank(r?.cpf) || (r?.cpf ?? '').replace(/\D/g, '').length < 11
                  ? '—'
                  : r?.cpf}
              </p>
            </div>
          </div>

          {student.specialNeeds && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 sm:col-span-2">
              <p className="text-urban-gray-data text-xs mb-1">Necessidades especiais</p>
              <p className="text-urban-gray-light text-sm">
                {student.specialNeedsDescription ?? 'Sim'}
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        open={excluirAberto}
        title={`Excluir o aluno ${student.name}?`}
        description="Esta ação não pode ser desfeita."
        onCancel={() => setExcluirAberto(false)}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}
