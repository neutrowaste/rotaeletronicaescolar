import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { fetchByCep } from '@/services/cepService';
import { geocodeAddress } from '@/services/geocodeService';
import type { School } from '@rota-eletronica/shared-types';
import { maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';

const STATUS_OPTIONS = [{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }];
const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';

function formatCepForAddress(rawCep: string) {
  const digits = rawCep.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function parseSchoolAddress(address?: string) {
  if (!address || address === '-') {
    return { cep: '', street: '', number: '', neighborhood: '', municipalityName: '', state: '' };
  }
  const cepMatch = address.match(/(\d{5})-?(\d{3})/);
  const cep = cepMatch ? cepMatch[0].replace(/\D/g, '') : '';
  const clean = cepMatch ? address.replace(cepMatch[0], '').replace(/\s{2,}/g, ' ').trim() : address;
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: parts[0] ?? '',
    number: parts[1] ?? '',
    neighborhood: parts[2] ?? '',
    municipalityName: parts[3] ?? '',
    state: parts[4] ?? '',
    cep,
  };
}

export function SchoolEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getSchoolById = useSchoolsStore((s) => s.getSchoolById);
  const updateSchool = useSchoolsStore((s) => s.updateSchool);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);
  const school = id ? getSchoolById(id) : undefined;

  const [name, setName] = useState('');
  const [state, setState] = useState('SP');
  const [municipalityId, setMunicipalityId] = useState('');
  const [ibgeCodeDisplay, setIbgeCodeDisplay] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [phone, setPhone] = useState('');
  const [principal, setPrincipal] = useState('');
  const [status, setStatus] = useState<School['status']>('active');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingGeocode, setLoadingGeocode] = useState(false);

  const municipalitiesByState = useMemo(
    () => municipalitiesList.filter((m) => m.state === state),
    [municipalitiesList, state]
  );
  const selectedMun = useMemo(
    () => (municipalityId ? municipalitiesList.find((m) => m.id === municipalityId) : null),
    [municipalitiesList, municipalityId]
  );

  useEffect(() => {
    if (!school) return;
    setName(school.name);
    setMunicipalityId(school.municipalityId);
    const mun = municipalitiesList.find((m) => m.id === school.municipalityId);
    if (mun) setState(mun.state);
    const parsed = parseSchoolAddress(school.address);
    setCep(parsed.cep);
    setRua(parsed.street);
    setNumero(parsed.number);
    setBairro(parsed.neighborhood);
    setPhone(maskPhone(String(school.phone ?? '')));
    setPrincipal(school.principal ?? '');
    setStatus(school.status);
    setLat(String(school.coordinates.lat));
    setLng(String(school.coordinates.lng));
  }, [school?.id, school?.municipalityId, municipalitiesList]);

  useEffect(() => {
    if (selectedMun) setIbgeCodeDisplay(selectedMun.ibgeCode ?? '');
    else setIbgeCodeDisplay('');
  }, [selectedMun]);

  useEffect(() => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    setLoadingCep(true);
    fetchByCep(cep)
      .then((res) => {
        if (res) {
          setRua(res.logradouro || '');
          setBairro(res.bairro || '');
        }
      })
      .finally(() => setLoadingCep(false));
  }, [cep]);

  useEffect(() => {
    const n = numero.trim();
    if (!rua.trim() || !selectedMun || !state) return;
    const fullAddress = [rua, n, bairro, selectedMun.name, state, 'Brasil'].filter(Boolean).join(', ');
    setLoadingGeocode(true);
    geocodeAddress(fullAddress)
      .then((res) => {
        if (res) {
          setLat(String(res.lat));
          setLng(String(res.lng));
        }
      })
      .finally(() => setLoadingGeocode(false));
  }, [rua, numero, bairro, selectedMun?.name, state]);

  const buildAddress = () => {
    const parts = [rua, numero, bairro].filter(Boolean);
    if (selectedMun) parts.push(selectedMun.name, state);
    const formattedCep = formatCepForAddress(cep);
    if (formattedCep) parts.push(formattedCep);
    return parts.join(', ') || '-';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !school) return;
    if (!name.trim()) {
      toast.error('Informe o nome da escola.');
      return;
    }
    if (!municipalityId) {
      toast.error('Selecione o município.');
      return;
    }
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      toast.error('Preencha CEP, rua e número para obter as coordenadas.');
      return;
    }
    const updated: School = {
      ...school,
      name: name.trim(),
      // Opção A: preservar endereço já salvo quando buildAddress() vier vazio (campos de edição não preenchidos)
      address: buildAddress() || school.address,
      municipalityId,
      coordinates: { lat: latNum, lng: lngNum },
      phone: unmaskDigits(phone) || '-',
      principal: principal.trim() || '-',
      totalStudents: school.totalStudents ?? 0,
      status,
    };
    updateSchool(updated);
    toast.success('Escola atualizada.');
    navigate(`/escolas/${id}`);
  };

  if (!school && id) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Escola não encontrada. <Link to="/escolas" className="text-urban-green hover:underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/escolas" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Editar Escola</h1>
      </div>
      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">Dados da escola</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Nome *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></div>
          <div />
          <div>
            <label className={labelClass}>Estado (UF) *</label>
            <select value={state} onChange={(e) => { setState(e.target.value); setMunicipalityId(''); }} className={inputClass}>
              {UF_OPTIONS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Município *</label>
            <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className={inputClass}>
              <option value="">Selecione</option>
              {municipalitiesByState.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </div>
          <div><label className={labelClass}>Código IBGE</label><input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>CEP</label><input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={loadingCep ? 'Buscando...' : '00000-000'} className={inputClass} /></div>
          <div><label className={labelClass}>Rua</label><input type="text" value={rua} onChange={(e) => setRua(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Bairro</label><input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Número *</label><input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={inputClass} /></div>
          <div><label className={labelClass}>Diretor(a)</label><input type="text" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={inputClass} /></div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
          <div><label className={labelClass}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value as School['status'])} className={inputClass}>{STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
          <div><label className={labelClass}>Latitude</label><input type="text" inputMode="decimal" value={lat} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>Longitude</label><input type="text" inputMode="decimal" value={lng} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Salvar alterações</button>
          <Link to={`/escolas/${id}`} className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
