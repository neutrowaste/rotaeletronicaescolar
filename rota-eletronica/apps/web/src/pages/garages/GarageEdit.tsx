import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { fetchByCep } from '@/services/cepService';
import { geocodeAddress } from '@/services/geocodeService';
import type { Garage } from '@rota-eletronica/shared-types';

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';

function formatCepForAddress(rawCep: string) {
  const digits = rawCep.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function parseGarageAddress(address?: string) {
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

export function GarageEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getGarageById = useGaragesStore((s) => s.getGarageById);
  const updateGarage = useGaragesStore((s) => s.updateGarage);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);
  const garage = id ? getGarageById(id) : undefined;

  const [name, setName] = useState('');
  const [state, setState] = useState('SP');
  const [municipalityId, setMunicipalityId] = useState('');
  const [ibgeCodeDisplay, setIbgeCodeDisplay] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingGeocode, setLoadingGeocode] = useState(false);

  const municipalitiesByState = useMemo(() => municipalitiesList.filter((m) => m.state === state), [municipalitiesList, state]);
  const selectedMun = useMemo(() => (municipalityId ? municipalitiesList.find((m) => m.id === municipalityId) : null), [municipalitiesList, municipalityId]);

  useEffect(() => {
    if (!garage) return;
    setName(garage.name);
    setMunicipalityId(garage.municipalityId);
    const mun = municipalitiesList.find((m) => m.id === garage.municipalityId);
    if (mun) setState(mun.state);
    const parsed = parseGarageAddress(garage.address);
    setCep(parsed.cep);
    setRua(parsed.street);
    setNumero(parsed.number);
    setBairro(parsed.neighborhood);
    setLat(String(garage.coordinates.lat));
    setLng(String(garage.coordinates.lng));
  }, [garage?.id, garage?.municipalityId, municipalitiesList]);

  useEffect(() => { if (selectedMun) setIbgeCodeDisplay(selectedMun.ibgeCode ?? ''); else setIbgeCodeDisplay(''); }, [selectedMun]);
  useEffect(() => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    setLoadingCep(true);
    fetchByCep(cep).then((res) => { if (res) { setRua(res.logradouro || ''); setBairro(res.bairro || ''); } }).finally(() => setLoadingCep(false));
  }, [cep]);
  useEffect(() => {
    const n = numero.trim();
    if (!rua.trim() || !selectedMun || !state) return;
    const fullAddress = [rua, n, bairro, selectedMun.name, state, 'Brasil'].filter(Boolean).join(', ');
    setLoadingGeocode(true);
    geocodeAddress(fullAddress).then((res) => { if (res) { setLat(String(res.lat)); setLng(String(res.lng)); } }).finally(() => setLoadingGeocode(false));
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
    if (!id || !garage) return;
    if (!name.trim()) { toast.error('Informe o nome da garagem.'); return; }
    if (!municipalityId) { toast.error('Selecione o município.'); return; }
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      toast.error('Preencha CEP, rua e número para obter as coordenadas.');
      return;
    }
    const updated: Garage = {
      ...garage,
      name: name.trim(),
      address: buildAddress() || garage.address,
      municipalityId,
      coordinates: { lat: latNum, lng: lngNum },
    };
    updateGarage(updated);
    toast.success('Garagem atualizada.');
    navigate(`/garagens/${id}`);
  };

  if (!garage) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Garagem não encontrada. <Link to="/garagens" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/garagens" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"><ArrowLeft size={18} /> Voltar</Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Editar Garagem</h1>
      </div>
      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Nome *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Garagem Centro" className={inputClass} /></div>
          <div />
          <div><label className={labelClass}>Estado (UF) *</label><select value={state} onChange={(e) => { setState(e.target.value); setMunicipalityId(''); }} className={inputClass}>{UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div><label className={labelClass}>Município *</label><select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className={inputClass}><option value="">Selecione</option>{municipalitiesByState.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className={labelClass}>Código IBGE</label><input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>CEP</label><input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={loadingCep ? 'Buscando...' : '00000-000'} className={inputClass} /></div>
          <div><label className={labelClass}>Rua</label><input type="text" value={rua} onChange={(e) => setRua(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Bairro</label><input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Número *</label><input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={inputClass} /></div>
          <div><label className={labelClass}>Latitude</label><input type="text" inputMode="decimal" value={lat} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>Longitude</label><input type="text" inputMode="decimal" value={lng} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Salvar alterações</button>
          <Link to={`/garagens/${id}`} className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
