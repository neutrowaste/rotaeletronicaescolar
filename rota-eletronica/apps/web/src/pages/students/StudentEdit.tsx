import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Folder, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudentsStore } from '@/store/studentsStore';
import { useRoutesStore } from '@/store/routesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { getStopsInMunicipalitySorted, BOARDING_STOP_OPTIONS_LIMIT } from '@/services/stopsService';
import { BoardingStopOptionsPicker } from '@/components/students/BoardingStopOptionsPicker';
import { fetchByCep } from '@/services/cepService';
import { geocodeAddress } from '@/services/geocodeService';
import { DateInput } from '@/components/forms/DateInput';
import type { ShiftPeriod, Student } from '@rota-eletronica/shared-types';
import { SHIFT_SELECT_OPTIONS, normalizeShiftToPeriod, shiftLabel } from '@rota-eletronica/shared-types';
import { maskCpf, maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';
import { normalizeCpfDigits } from '@/utils/cpf';
import { StudentIncompleteBanner } from '@/components/students/StudentIncompleteBanner';
import { StudentIncompleteFieldLabel } from '@/components/students/StudentIncompleteFieldLabel';
import {
  getStudentIncompleteFieldSet,
  getStudentIncompleteMessages,
  incompleteInputClass,
  INCOMPLETE_EMPTY_BOX_HIGHLIGHT,
  INCOMPLETE_PHOTO_FRAME,
  type StudentIncompleteField,
} from '@/utils/studentCompleteness';

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano'];
const RELATIONSHIP_OPTIONS = ['Pai', 'Mãe', 'Avô', 'Avó', 'Tio', 'Tia', 'Responsável legal'];
const STATUS_OPTIONS = [{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }, { value: 'transferred', label: 'Transferido' }];
const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';

function parseAddressFields(address?: string) {
  if (!address || address === '-') return { cep: '', street: '', number: '', neighborhood: '' };
  const cepMatch = address.match(/(\d{5})-?(\d{3})/);
  const cep = cepMatch ? cepMatch[0].replace(/\D/g, '') : '';
  const addressWithoutCep = cepMatch ? address.replace(cepMatch[0], '').replace(/\s{2,}/g, ' ').trim() : address;
  const parts = addressWithoutCep.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    cep,
    street: parts[0] ?? '',
    number: parts[1] ?? '',
    neighborhood: parts[2] ?? '',
  };
}

function formatCepForAddress(rawCep: string) {
  const digits = rawCep.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function StudentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fetchStudentById = useStudentsStore((s) => s.fetchStudentById);
  const updateStudent = useStudentsStore((s) => s.updateStudent);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const student = useStudentsStore((s) => (id ? s.items.find((st) => st.id === id) : undefined));
  const [loadingStudent, setLoadingStudent] = useState(Boolean(id));
  const routes = getRoutes();
  const schoolsList = getSchools();

  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [grade, setGrade] = useState(GRADES[0]);
  const [shift, setShift] = useState<ShiftPeriod>('morning');
  const [state, setState] = useState('SP');
  const [municipalityId, setMunicipalityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [ibgeCodeDisplay, setIbgeCodeDisplay] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [addressLat, setAddressLat] = useState('');
  const [addressLng, setAddressLng] = useState('');
  const [selectedStopKey, setSelectedStopKey] = useState('');
  const [respName, setRespName] = useState('');
  const [respRelationship, setRespRelationship] = useState(RELATIONSHIP_OPTIONS[0]);
  const [respCpf, setRespCpf] = useState('');
  const [respPhone, setRespPhone] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState(false);
  const [specialNeedsDescription, setSpecialNeedsDescription] = useState('');
  const [status, setStatus] = useState<Student['status']>('active');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoRemoved(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const openPhotoGallery = () => fileInputRef.current?.click();

  const openPhotoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      toast.error('Não foi possível acessar a câmera.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    setPhotoRemoved(false);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    closeCamera();
  };

  const confirmRemovePhoto = () => {
    setPhotoDataUrl(null);
    setPhotoRemoved(true);
    setShowRemovePhotoModal(false);
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingStudent(true);
    void fetchStudentById(id).finally(() => {
      if (!cancelled) setLoadingStudent(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, fetchStudentById]);

  useEffect(() => {
    if (!student) return;
    setName(student.name);
    setRegistrationNumber(student.registrationNumber ?? '');
    setBirthDate(
      !student.birthDate || student.birthDate === '-'
        ? ''
        : student.birthDate.slice(0, 10)
    );
    const loadedGrade = (student.grade ?? '').trim();
    setGrade(loadedGrade === '-' ? '' : loadedGrade);
    setShift(normalizeShiftToPeriod(student.shift ?? 'morning'));
    setMunicipalityId(student.municipalityId);
    setSchoolId(student.schoolId ?? '');
    const mun = municipalitiesList.find((m) => m.id === student.municipalityId);
    if (mun) setState(mun.state);
    const parsedAddress = parseAddressFields(student.address);
    setCep(student.addressFields?.cep ?? student.boardingPoint?.cep ?? parsedAddress.cep);
    setRua(student.addressFields?.street ?? parsedAddress.street);
    setNumero(student.addressFields?.number ?? parsedAddress.number);
    setBairro(student.addressFields?.neighborhood ?? parsedAddress.neighborhood);
    setAddressLat(
      student.boardingPoint?.homeCoordinates
        ? String(student.boardingPoint.homeCoordinates.lat)
        : ''
    );
    setAddressLng(
      student.boardingPoint?.homeCoordinates
        ? String(student.boardingPoint.homeCoordinates.lng)
        : ''
    );
    setSelectedStopKey('');
    setRespName(student.responsible?.name ?? '');
    const loadedRelationship = (student.responsible?.relationship ?? '').trim();
    setRespRelationship(loadedRelationship === '-' ? '' : loadedRelationship);
    setRespCpf(maskCpf(String(student.responsible?.cpf ?? '')));
    setRespPhone(maskPhone(String(student.responsible?.phone ?? '')));
    setRespEmail(student.responsible?.email ?? '');
    setSpecialNeeds(student.specialNeeds ?? false);
    setSpecialNeedsDescription(student.specialNeedsDescription ?? '');
    setStatus(student.status);
  }, [student?.id, municipalitiesList]);

  const municipalitiesByState = useMemo(() => municipalitiesList.filter((m) => m.state === state), [municipalitiesList, state]);
  const selectedMun = useMemo(() => (municipalityId ? municipalitiesList.find((m) => m.id === municipalityId) : null), [municipalitiesList, municipalityId]);

  useEffect(() => { if (selectedMun) setIbgeCodeDisplay(selectedMun.ibgeCode ?? ''); else setIbgeCodeDisplay(''); }, [selectedMun]);
  useEffect(() => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    fetchByCep(cep).then((res) => { if (res) { setRua(res.logradouro || ''); setBairro(res.bairro || ''); } });
  }, [cep]);
  useEffect(() => {
    const n = numero.trim();
    if (!rua.trim() || !selectedMun || !state) return;
    const fullAddress = [rua, n, bairro, selectedMun.name, state, 'Brasil'].filter(Boolean).join(', ');
    geocodeAddress(fullAddress).then((res) => { if (res) { setAddressLat(String(res.lat)); setAddressLng(String(res.lng)); } });
  }, [rua, numero, bairro, selectedMun?.name, state]);

  const buildAddress = () => {
    const parts = [rua, numero, bairro].filter(Boolean);
    if (selectedMun) parts.push(selectedMun.name, state);
    const formattedCep = formatCepForAddress(cep);
    if (formattedCep) parts.push(formattedCep);
    return parts.join(', ') || '-';
  };

  const schoolsInMun = useMemo(() => (municipalityId ? schoolsList.filter((s) => s.municipalityId === municipalityId) : []), [schoolsList, municipalityId]);
  const selectedSchool = useMemo(() => (schoolId ? schoolsList.find((s) => s.id === schoolId) : null), [schoolsList, schoolId]);
  const referenceForStop = useMemo(() => {
    if (addressLat && addressLng) {
      const lat = parseFloat(addressLat);
      const lng = parseFloat(addressLng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
    return selectedSchool?.coordinates ?? null;
  }, [addressLat, addressLng, selectedSchool]);
  const stopsNearHome = useMemo(() => {
    if (!municipalityId || !schoolId) return [];
    return getStopsInMunicipalitySorted(
      routes,
      municipalityId,
      referenceForStop,
      referenceForStop,
      BOARDING_STOP_OPTIONS_LIMIT,
      schoolId,
      shift
    ).stopsForBoarding;
  }, [municipalityId, schoolId, shift, routes, referenceForStop, selectedSchool]);

  useEffect(() => {
    if (stopsNearHome.length === 0) {
      setSelectedStopKey('');
      return;
    }
    if (stopsNearHome.some((s) => s.key === selectedStopKey)) return;
    if (student?.routeId) {
      const byRoute = stopsNearHome.find((s) => s.routeId === student.routeId);
      if (byRoute) {
        setSelectedStopKey(byRoute.key);
        return;
      }
    }
    setSelectedStopKey(stopsNearHome[0].key);
  }, [stopsNearHome, selectedStopKey, student?.routeId]);

  const incompleteSnapshot = useMemo((): Student | null => {
    if (!student) return null;
    const school = schoolsList.find((sc) => sc.id === schoolId);
    const homeStop =
      stopsNearHome.find((s) => s.key === selectedStopKey) ?? stopsNearHome[0] ?? null;
    return {
      ...student,
      name: name.trim(),
      registrationNumber: registrationNumber.trim(),
      birthDate: birthDate.trim(),
      grade: grade.trim(),
      shift,
      schoolId,
      municipalityId,
      address: buildAddress(),
      boardingPoint: homeStop
        ? {
            address: homeStop.address,
            coordinates: homeStop.coordinates,
            homeCoordinates:
              addressLat && addressLng
                ? { lat: parseFloat(addressLat), lng: parseFloat(addressLng) }
                : student.boardingPoint?.homeCoordinates,
            distanceMeters: homeStop.distanceMeters,
            cep: cep.trim() || undefined,
          }
        : student.boardingPoint,
      alightingPoint: school
        ? { address: school.address, coordinates: { ...school.coordinates } }
        : student.alightingPoint,
      responsible: {
        name: respName.trim(),
        relationship: respRelationship.trim(),
        cpf: normalizeCpfDigits(respCpf) || '-',
        phone: unmaskDigits(respPhone) || '-',
        email: respEmail.trim() || '-',
      },
      photo: photoRemoved
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim() || 'A')}&background=random`
        : (photoDataUrl ?? student.photo),
    };
  }, [
    student,
    name,
    registrationNumber,
    birthDate,
    grade,
    shift,
    schoolId,
    municipalityId,
    cep,
    rua,
    bairro,
    numero,
    state,
    respName,
    respRelationship,
    respCpf,
    respPhone,
    respEmail,
    photoRemoved,
    photoDataUrl,
    stopsNearHome,
    selectedStopKey,
    schoolsList,
  ]);

  const incompleteMessages = useMemo(
    () => (incompleteSnapshot ? getStudentIncompleteMessages(incompleteSnapshot) : []),
    [incompleteSnapshot]
  );
  const incomplete = useMemo(
    () =>
      incompleteSnapshot
        ? getStudentIncompleteFieldSet(incompleteSnapshot)
        : new Set<StudentIncompleteField>(),
    [incompleteSnapshot]
  );
  const ic = (field: StudentIncompleteField) => incompleteInputClass(inputClass, field, incomplete);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !student) return;
    if (!name.trim()) {
      toast.error('Informe o nome do aluno.');
      return;
    }
    if (!registrationNumber.trim()) {
      toast.error('Informe a matrícula.');
      return;
    }
    if (!municipalityId || !schoolId) {
      toast.error('Selecione município e escola.');
      return;
    }
    const school = schoolsList.find((s) => s.id === schoolId);
    const baseCoord = school?.coordinates ?? { lat: -23.55, lng: -46.63 };
    if (stopsNearHome.length > 0 && !selectedStopKey) {
      toast.error('Selecione uma das opções de parada e rota.');
      return;
    }

    const homeStop = stopsNearHome.find((s) => s.key === selectedStopKey);

    if (!homeStop) {
      toast.error(
        'Nenhuma parada de ônibus encontrada para este endereço, escola e turno. Cadastre rotas com paradas ou ajuste o endereço antes de salvar.'
      );
      return;
    }

    const updated: Student = {
      ...student,
      name: name.trim(),
      registrationNumber: registrationNumber.trim(),
      birthDate: birthDate.trim(),
      grade: grade.trim(),
      shift,
      schoolId,
      municipalityId,
      address: buildAddress() || student.address,
      boardingPoint: {
        address: homeStop.address,
        coordinates: homeStop.coordinates,
        homeCoordinates:
          addressLat && addressLng
            ? { lat: parseFloat(addressLat), lng: parseFloat(addressLng) }
            : undefined,
        distanceMeters: homeStop.distanceMeters,
        cep: cep.trim() || undefined,
      },
      addressFields: {
        cep: cep.trim(),
        street: rua.trim(),
        number: numero.trim(),
        neighborhood: bairro.trim(),
      },
      alightingPoint: { address: school?.address ?? '-', coordinates: { ...baseCoord } },
      responsible: {
        name: respName.trim(),
        relationship: respRelationship.trim(),
        cpf: normalizeCpfDigits(respCpf) || '-',
        phone: unmaskDigits(respPhone) || '-',
        email: respEmail.trim() || '-',
      },
      routeId: homeStop.routeId ?? student.routeId ?? null,
      specialNeeds,
      specialNeedsDescription: specialNeeds ? specialNeedsDescription.trim() : undefined,
      status,
      photo: photoRemoved
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`
        : (photoDataUrl ?? student.photo),
    };
    updateStudent(updated);
    toast.success('Aluno atualizado.');
    navigate(`/alunos/${id}`);
  };

  if (loadingStudent) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Carregando aluno…
      </div>
    );
  }

  if (!student && id) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Aluno não encontrado. <Link to="/alunos" className="text-urban-green hover:underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/alunos" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"><ArrowLeft size={18} /> Voltar</Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Editar Aluno</h1>
      </div>
      <StudentIncompleteBanner messages={incompleteMessages} />
      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Dados do aluno</h2>
        <div className="flex flex-col items-center mb-6">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} aria-hidden />
          <div
            className={`w-28 aspect-[3/4] rounded-lg overflow-hidden border-2 bg-white/5 flex items-center justify-center flex-shrink-0 ${
              incomplete.has('photo') ? INCOMPLETE_PHOTO_FRAME : 'border-urban-petrol/50'
            }`}
          >
            {(photoDataUrl ?? (student?.photo && !photoRemoved)) ? (
              <img src={photoDataUrl ?? student?.photo} alt="" className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-3xl font-semibold text-urban-gray-data">{name.trim() ? name.trim().charAt(0) : '?'}</span>
            )}
          </div>
          <div className="text-center mt-2">
            {(photoDataUrl || (student?.photo && !photoRemoved)) && (
              <button type="button" onClick={() => setShowRemovePhotoModal(true)} className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium mx-auto">
                <Trash2 size={18} /> Remover foto
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <button type="button" onClick={openPhotoCamera} className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium">
              <Camera size={18} /> Tirar foto
            </button>
            <span className="text-urban-gray-data text-sm">ou</span>
            <button type="button" onClick={openPhotoGallery} className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium">
              <Folder size={18} /> Carregar foto
            </button>
          </div>
        </div>

        {showRemovePhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-photo-title-edit">
            <div className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-5 [color:white]" onClick={(e) => e.stopPropagation()}>
              <p id="remove-photo-title-edit" className="font-medium mb-1">Deseja remover a foto?</p>
              <p className="text-sm text-white/90 mb-4">Esta ação não poderá ser desfeita.</p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowRemovePhotoModal(false)} className="px-4 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium border border-white/20">
                  Cancelar
                </button>
                <button type="button" onClick={confirmRemovePhoto} className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Câmera">
            <div className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-4 [color:white]" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm mb-3">Posicione o rosto no enquadramento</p>
              <div className="aspect-[3/4] w-full max-w-[240px] mx-auto rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover object-top" />
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <button type="button" onClick={capturePhoto} className="px-6 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium text-sm">
                  Capturar
                </button>
                <button type="button" onClick={closeCamera} className="px-6 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 border border-white/20 text-sm font-medium">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <StudentIncompleteFieldLabel field="name" incomplete={incomplete} className={labelClass}>Nome completo *</StudentIncompleteFieldLabel>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={ic('name')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="registrationNumber" incomplete={incomplete} className={labelClass}>Matrícula *</StudentIncompleteFieldLabel>
            <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={ic('registrationNumber')} required />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="birthDate" incomplete={incomplete} className={labelClass}>Data de nascimento</StudentIncompleteFieldLabel>
            <DateInput value={birthDate} onChange={setBirthDate} className={ic('birthDate')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="grade" incomplete={incomplete} className={labelClass}>Série</StudentIncompleteFieldLabel>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className={ic('grade')}>
              <option value="">Selecione</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Turno</label>
            <select
              value={shift}
              onChange={(e) => {
                setShift(e.target.value as ShiftPeriod);
                setSelectedStopKey('');
              }}
              className={inputClass}
            >
              {SHIFT_SELECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div><label className={labelClass}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value as Student['status'])} className={inputClass}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">Dados do Responsável</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <StudentIncompleteFieldLabel field="responsibleName" incomplete={incomplete} className={labelClass}>Nome do responsável *</StudentIncompleteFieldLabel>
            <input type="text" value={respName} onChange={(e) => setRespName(e.target.value)} className={ic('responsibleName')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="responsibleRelationship" incomplete={incomplete} className={labelClass}>Parentesco</StudentIncompleteFieldLabel>
            <select value={respRelationship} onChange={(e) => setRespRelationship(e.target.value)} className={ic('responsibleRelationship')}>
              <option value="">Selecione</option>
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <StudentIncompleteFieldLabel field="responsibleCpf" incomplete={incomplete} className={labelClass}>CPF</StudentIncompleteFieldLabel>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={respCpf}
              onChange={(e) => setRespCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className={ic('responsibleCpf')}
            />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="responsiblePhone" incomplete={incomplete} className={labelClass}>Telefone</StudentIncompleteFieldLabel>
            <input
              type="text"
              inputMode="tel"
              autoComplete="tel"
              value={respPhone}
              onChange={(e) => setRespPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={ic('responsiblePhone')}
            />
          </div>
          <div className="sm:col-span-2">
            <StudentIncompleteFieldLabel field="responsibleEmail" incomplete={incomplete} className={labelClass}>E-mail</StudentIncompleteFieldLabel>
            <input type="email" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} className={ic('responsibleEmail')} />
          </div>
        </div>
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">Necessidades especiais</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.checked)} className="rounded border-urban-petrol/50 bg-white/5 text-urban-green focus:ring-urban-green" />
            <span className="text-sm text-urban-gray-light">Aluno com necessidades especiais</span>
          </label>
          {specialNeeds && <div><label className={labelClass}>Descrição</label><textarea value={specialNeedsDescription} onChange={(e) => setSpecialNeedsDescription(e.target.value)} rows={2} className={inputClass} /></div>}
        </div>
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">Endereço do aluno e Escola</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Estado (UF) *</label><select value={state} onChange={(e) => { setState(e.target.value); setMunicipalityId(''); setSchoolId(''); setSelectedStopKey(''); }} className={inputClass}>{UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div>
            <StudentIncompleteFieldLabel field="municipalityId" incomplete={incomplete} className={labelClass}>Município *</StudentIncompleteFieldLabel>
            <select value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); setSchoolId(''); setSelectedStopKey(''); }} className={ic('municipalityId')}><option value="">Selecione</option>{municipalitiesByState.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
          <div><label className={labelClass}>Código IBGE</label><input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div>
            <StudentIncompleteFieldLabel field="schoolId" incomplete={incomplete} className={labelClass}>Escola *</StudentIncompleteFieldLabel>
            <select value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setSelectedStopKey(''); }} disabled={!municipalityId} className={ic('schoolId')}><option value="">Selecione</option>{schoolsInMun.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <div>
            <StudentIncompleteFieldLabel field="address" incomplete={incomplete} className={labelClass}>CEP</StudentIncompleteFieldLabel>
            <input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000-000" className={ic('address')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="address" incomplete={incomplete} className={labelClass}>Rua</StudentIncompleteFieldLabel>
            <input type="text" value={rua} onChange={(e) => setRua(e.target.value)} className={ic('address')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="address" incomplete={incomplete} className={labelClass}>Bairro</StudentIncompleteFieldLabel>
            <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className={ic('address')} />
          </div>
          <div>
            <StudentIncompleteFieldLabel field="address" incomplete={incomplete} className={labelClass}>Número *</StudentIncompleteFieldLabel>
            <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={ic('address')} />
          </div>
          <div><label className={labelClass}>Latitude do endereço</label><input type="text" inputMode="decimal" value={addressLat} readOnly placeholder="Preenchido pelo endereço" className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>Longitude do endereço</label><input type="text" inputMode="decimal" value={addressLng} readOnly placeholder="Preenchido pelo endereço" className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
        </div>
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">Trajeto, Parada, Embarque e Desembarque</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg bg-urban-petrol/10 border border-urban-petrol/30 p-3 text-sm text-urban-gray-light space-y-1">
            <p className="font-medium text-urban-green">Como funciona o trajeto do aluno:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-urban-gray-data">
              <li><strong className="text-urban-gray-light">Ida:</strong> Embarque na parada mais próxima do endereço do aluno → Desembarque na escola em que está matriculado.</li>
              <li><strong className="text-urban-gray-light">Volta:</strong> Embarque na escola → Desembarque na mesma parada da casa (item 1).</li>
            </ol>
          </div>
          <div className="sm:col-span-2">
            <StudentIncompleteFieldLabel field="boardingPoint" incomplete={incomplete} className={labelClass}>
              Parada e rota (casa do aluno) *
            </StudentIncompleteFieldLabel>
            <BoardingStopOptionsPicker
              options={stopsNearHome}
              selectedKey={selectedStopKey}
              onSelect={setSelectedStopKey}
              schoolName={selectedSchool?.name}
              shiftLabelText={shiftLabel(shift)}
              hasMunicipality={Boolean(municipalityId)}
              hasSchool={Boolean(schoolId)}
              highlightIncomplete
              incomplete={incomplete}
              emptyWhenNoMunicipality="Selecione o município, a escola e informe o endereço para listar as opções de parada."
              emptyWhenNoSchool="Selecione a escola matriculada — as opções são apenas das rotas que levam a essa escola."
              emptyWhenNoStops="Nenhuma parada encontrada para esta escola, turno e município. Cadastre rotas com paradas ou verifique se o endereço foi georreferenciado."
            />
          </div>
          <div
            className={`sm:col-span-2 rounded-lg border p-3 text-sm text-urban-gray-data ${
              incomplete.has('alightingPoint') || incomplete.has('schoolId')
                ? INCOMPLETE_EMPTY_BOX_HIGHLIGHT
                : 'bg-white/5 border-urban-petrol/30'
            }`}
          >
            <StudentIncompleteFieldLabel field="alightingPoint" incomplete={incomplete} className={labelClass}>
              Desembarque/embarque na escola
            </StudentIncompleteFieldLabel>
            <p>
              <strong className="text-urban-gray-light">Escola selecionada:</strong>{' '}
              {selectedSchool?.name ?? '—'} — onde o aluno desembarca de manhã e embarca à tarde.
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Salvar alterações</button>
          <Link to="/alunos" className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
