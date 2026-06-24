import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export function GarageCreate() {
  const navigate = useNavigate();
  const addGarage = useGaragesStore((s) => s.addGarage);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe o nome da garagem.'); return; }
    if (!municipalityId) { toast.error('Selecione o município.'); return; }
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      toast.error('Preencha CEP, rua e número para obter as coordenadas automaticamente.');
      return;
    }
    const garage: Omit<Garage, 'id'> = {
      name: name.trim(),
      address: buildAddress(),
      municipalityId,
      coordinates: { lat: latNum, lng: lngNum },
    };
    try {
      await addGarage(garage);
      toast.success('Garagem cadastrada.');
      navigate('/garagens');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar garagem.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/garagens" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"><ArrowLeft size={18} /> Voltar</Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Nova Garagem</h1>
      </div>
      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Nome *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Garagem Centro" className={inputClass} /></div>
          <div />
          <div><label className={labelClass}>Estado (UF) *</label><select value={state} onChange={(e) => { setState(e.target.value); setMunicipalityId(''); }} className={inputClass}>{UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div><label className={labelClass}>Município *</label><select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className={inputClass}><option value="">Selecione</option>{municipalitiesByState.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className={labelClass}>Código IBGE</label><input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>CEP</label><input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={loadingCep ? 'Buscando...' : '00000-000'} className={inputClass} /></div>
          <div><label className={labelClass}>Rua</label><input type="text" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} /></div>
          <div><label className={labelClass}>Bairro</label><input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} /></div>
          <div><label className={labelClass}>Número *</label><input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={inputClass} /></div>
          <div><label className={labelClass}>Latitude</label><input type="text" inputMode="decimal" value={lat} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>Longitude</label><input type="text" inputMode="decimal" value={lng} readOnly placeholder={loadingGeocode ? 'Buscando...' : 'Preenchido pelo endereço'} className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Cadastrar garagem</button>
          <Link to="/garagens" className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
