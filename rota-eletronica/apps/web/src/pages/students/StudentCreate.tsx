import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { SHIFT_SELECT_OPTIONS, shiftLabel } from '@rota-eletronica/shared-types';
import { maskCpf, maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';
import { normalizeCpfDigits } from '@/utils/cpf';

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano'];
const RELATIONSHIP_OPTIONS = ['Pai', 'Mãe', 'Avô', 'Avó', 'Tio', 'Tia', 'Responsável legal'];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'transferred', label: 'Transferido' },
];

function formatCepForAddress(rawCep: string) {
  const digits = rawCep.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function StudentCreate() {
  const navigate = useNavigate();
  const addStudent = useStudentsStore((s) => s.addStudent);
  const getRoutes = useRoutesStore((s) => s.getRoutes);
  const getSchools = useSchoolsStore((s) => s.getSchools);
  const municipalitiesList = useMunicipalitiesStore((s) => s.getMunicipalities)();
  const routes = getRoutes();
  const schoolsList = getSchools();

  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [grade, setGrade] = useState('');
  const [shift, setShift] = useState<ShiftPeriod>('morning');
  const [state, setState] = useState('SP');
  const [municipalityId, setMunicipalityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [ibgeCodeDisplay, setIbgeCodeDisplay] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [addressLat, setAddressLat] = useState<string>('');
  const [addressLng, setAddressLng] = useState<string>('');
  const [selectedStopKey, setSelectedStopKey] = useState('');
  const [respName, setRespName] = useState('');
  const [respRelationship, setRespRelationship] = useState('');
  const [respCpf, setRespCpf] = useState('');
  const [respPhone, setRespPhone] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState(false);
  const [specialNeedsDescription, setSpecialNeedsDescription] = useState('');
  const [status, setStatus] = useState<Student['status']>('active');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    closeCamera();
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

  const municipalitiesByState = useMemo(
    () => municipalitiesList.filter((m) => m.state === state),
    [municipalitiesList, state]
  );
  const selectedMun = useMemo(
    () => (municipalityId ? municipalitiesList.find((m) => m.id === municipalityId) : null),
    [municipalitiesList, municipalityId]
  );
  const schoolsInMun = useMemo(
    () => (municipalityId ? schoolsList.filter((s) => s.municipalityId === municipalityId) : []),
    [schoolsList, municipalityId]
  );
  const selectedSchool = useMemo(
    () => (schoolId ? schoolsList.find((s) => s.id === schoolId) : null),
    [schoolsList, schoolId]
  );

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
    if (selectedMun) setIbgeCodeDisplay(selectedMun.ibgeCode ?? '');
    else setIbgeCodeDisplay('');
  }, [selectedMun]);

  useEffect(() => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    fetchByCep(cep).then((res) => {
      if (res) { setRua(res.logradouro || ''); setBairro(res.bairro || ''); }
    });
  }, [cep]);

  useEffect(() => {
    const n = numero.trim();
    if (!rua.trim() || !selectedMun || !state) return;
    const fullAddress = [rua, n, bairro, selectedMun.name, state, 'Brasil'].filter(Boolean).join(', ');
    geocodeAddress(fullAddress).then((res) => {
      if (res) { setAddressLat(String(res.lat)); setAddressLng(String(res.lng)); }
    });
  }, [rua, numero, bairro, selectedMun?.name, state]);

  const buildAddress = () => {
    const parts = [rua, numero, bairro].filter(Boolean);
    if (selectedMun) parts.push(selectedMun.name, state);
    const formattedCep = formatCepForAddress(cep);
    if (formattedCep) parts.push(formattedCep);
    return parts.join(', ') || '-';
  };

  const handleMunicipalityChange = (munId: string) => {
    setMunicipalityId(munId);
    setSchoolId('');
    setSelectedStopKey('');
  };

  const handleSchoolChange = (sid: string) => {
    setSchoolId(sid);
    setSelectedStopKey('');
  };

  useEffect(() => {
    if (stopsNearHome.length === 0) {
      setSelectedStopKey('');
      return;
    }
    if (stopsNearHome.some((s) => s.key === selectedStopKey)) return;
    setSelectedStopKey(stopsNearHome[0].key);
  }, [stopsNearHome, selectedStopKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do aluno.');
      return;
    }
    if (!registrationNumber.trim()) {
      toast.error('Informe a matrícula.');
      return;
    }
    if (!municipalityId) {
      toast.error('Selecione o município.');
      return;
    }
    if (!schoolId) {
      toast.error('Selecione a escola.');
      return;
    }
    if (!respName.trim()) {
      toast.error('Informe o nome do responsável.');
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
        'Nenhuma parada de ônibus encontrada para este endereço, escola e turno. Cadastre rotas com paradas ou ajuste o endereço antes de salvar o aluno.'
      );
      return;
    }

    const student: Omit<Student, 'id'> = {
      name: name.trim(),
      registrationNumber: registrationNumber.trim(),
      birthDate: birthDate.trim(),
      grade: grade.trim(),
      shift,
      schoolId,
      municipalityId,
      address: buildAddress(),
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
      alightingPoint: {
        address: school?.address ?? '-',
        coordinates: { ...baseCoord },
      },
      responsible: {
        name: respName.trim(),
        relationship: respRelationship.trim(),
        cpf: normalizeCpfDigits(respCpf) || '-',
        phone: unmaskDigits(respPhone) || '-',
        email: respEmail.trim() || '-',
      },
      specialNeeds,
      specialNeedsDescription: specialNeeds ? specialNeedsDescription.trim() : undefined,
      routeId: homeStop.routeId ?? null,
      status,
      photo: photoDataUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`,
    };
    try {
      await addStudent(student);
      toast.success('Aluno cadastrado.');
      navigate('/alunos');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar aluno.');
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
  const labelClass = 'block text-xs text-urban-gray-data mb-1';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Link
          to="/alunos"
          className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Novo Aluno</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">
          Dados do aluno
        </h2>
        <div className="flex flex-col items-center mb-6">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} aria-hidden />
          <div className="w-28 aspect-[3/4] rounded-lg overflow-hidden border-2 border-urban-petrol/50 bg-white/5 flex items-center justify-center flex-shrink-0">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="" className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-3xl font-semibold text-urban-gray-data">{name.trim() ? name.trim().charAt(0) : '?'}</span>
            )}
          </div>
          <div className="text-center mt-2">
            {photoDataUrl && (
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-photo-title">
            <div className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-5 [color:white]" onClick={(e) => e.stopPropagation()}>
              <p id="remove-photo-title" className="font-medium mb-1">Deseja remover a foto?</p>
              <p className="text-sm text-white/90 mb-4">Esta ação não poderá ser desfeita.</p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowRemovePhotoModal(false)} className="px-4 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium border border-white/20">
                  Cancelar
                </button>
                <button type="button" onClick={() => { setPhotoDataUrl(null); setShowRemovePhotoModal(false); }} className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium">
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
            <label className={labelClass}>Nome completo *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do aluno"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Matrícula *</label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="Número da matrícula"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Data de nascimento</label>
            <DateInput value={birthDate} onChange={setBirthDate} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Série</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
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
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Student['status'])}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Dados do Responsável
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nome do responsável *</label>
            <input
              type="text"
              value={respName}
              onChange={(e) => setRespName(e.target.value)}
              placeholder="Nome completo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Parentesco</label>
            <select
              value={respRelationship}
              onChange={(e) => setRespRelationship(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CPF</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={respCpf}
              onChange={(e) => setRespCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              inputMode="tel"
              autoComplete="tel"
              value={respPhone}
              onChange={(e) => setRespPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={respEmail}
              onChange={(e) => setRespEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Necessidades especiais
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={specialNeeds}
              onChange={(e) => setSpecialNeeds(e.target.checked)}
              className="rounded border-urban-petrol/50 bg-white/5 text-urban-green focus:ring-urban-green"
            />
            <span className="text-sm text-urban-gray-light">Aluno com necessidades especiais</span>
          </label>
          {specialNeeds && (
            <div>
              <label className={labelClass}>Descrição (opcional)</label>
              <textarea
                value={specialNeedsDescription}
                onChange={(e) => setSpecialNeedsDescription(e.target.value)}
                placeholder="Descreva se necessário"
                rows={2}
                className={inputClass}
              />
            </div>
          )}
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Endereço do aluno e Escola
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Estado (UF) *</label>
            <select value={state} onChange={(e) => { setState(e.target.value); setMunicipalityId(''); setSchoolId(''); setSelectedStopKey(''); }} className={inputClass}>
              {UF_OPTIONS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Município *</label>
            <select value={municipalityId} onChange={(e) => handleMunicipalityChange(e.target.value)} className={inputClass}>
              <option value="">Selecione o município</option>
              {municipalitiesByState.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Código IBGE</label>
            <input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} />
          </div>
          <div>
            <label className={labelClass}>Escola *</label>
            <select value={schoolId} onChange={(e) => handleSchoolChange(e.target.value)} disabled={!municipalityId} className={inputClass}>
              <option value="">Selecione a escola</option>
              {schoolsInMun.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CEP</label>
            <input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000-000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Rua</label>
            <input type="text" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bairro</label>
            <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Número *</label>
            <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Latitude do endereço</label>
            <input type="text" inputMode="decimal" value={addressLat} readOnly placeholder="Preenchido pelo endereço" className={inputClass + ' bg-white/5 cursor-not-allowed'} />
            <p className="text-xs text-urban-gray-data mt-0.5">Usado para sugerir a parada mais próxima ao aluno</p>
          </div>
          <div>
            <label className={labelClass}>Longitude do endereço</label>
            <input type="text" inputMode="decimal" value={addressLng} readOnly placeholder="Preenchido pelo endereço" className={inputClass + ' bg-white/5 cursor-not-allowed'} />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Trajeto, Parada, Embarque e Desembarque
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg bg-urban-petrol/10 border border-urban-petrol/30 p-3 text-sm text-urban-gray-light space-y-1">
            <p className="font-medium text-urban-green">Como funciona o trajeto do aluno:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-urban-gray-data">
              <li><strong className="text-urban-gray-light">Ida:</strong> Embarque na parada mais próxima do endereço do aluno → Desembarque na escola em que está matriculado.</li>
              <li><strong className="text-urban-gray-light">Volta:</strong> Embarque na escola → Desembarque na mesma parada da casa (item 1).</li>
            </ol>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Parada e rota (casa do aluno) *</label>
            <BoardingStopOptionsPicker
              options={stopsNearHome}
              selectedKey={selectedStopKey}
              onSelect={setSelectedStopKey}
              schoolName={selectedSchool?.name}
              shiftLabelText={shiftLabel(shift)}
              hasMunicipality={Boolean(municipalityId)}
              hasSchool={Boolean(schoolId)}
              emptyWhenNoMunicipality="Selecione o município, a escola e informe o endereço para listar as opções de parada."
              emptyWhenNoSchool="Selecione a escola matriculada — as opções são apenas das rotas que levam a essa escola."
              emptyWhenNoStops="Nenhuma parada encontrada para esta escola, turno e município. Cadastre rotas com paradas ou verifique se o endereço foi georreferenciado."
            />
          </div>
          <div
            className="sm:col-span-2 rounded-lg bg-white/5 border border-urban-petrol/30 p-3 text-sm text-urban-gray-data"
          >
            <label className={labelClass}>Desembarque/embarque na escola</label>
            <p>
              <strong className="text-urban-gray-light">Escola selecionada:</strong>{' '}
              {selectedSchool?.name ?? '—'} — onde o aluno desembarca de manhã e embarca à tarde.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            Cadastrar aluno
          </button>
          <Link
            to="/alunos"
            className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}


