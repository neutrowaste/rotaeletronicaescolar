import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDriversStore } from '@/store/driversStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { DateInput } from '@/components/forms/DateInput';
import { fetchByCep } from '@/services/cepService';
import type { Driver } from '@rota-eletronica/shared-types';
import { maskCpf, maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';
import { normalizeCpfDigits } from '@/utils/cpf';

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';

const CATEGORIAS = ['B', 'C', 'D', 'E'];

function formatCepForAddress(rawCep: string) {
  const digits = rawCep.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function DriverCreate() {
  const navigate = useNavigate();
  const addDriver = useDriversStore((s) => s.addDriver);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [state, setState] = useState('SP');
  const [addressMunicipalityId, setAddressMunicipalityId] = useState('');
  const [ibgeCodeDisplay, setIbgeCodeDisplay] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [numero, setNumero] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [municipalityIds, setMunicipalityIds] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseCategory, setLicenseCategory] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  const municipalitiesByState = useMemo(() => municipalitiesList.filter((m) => m.state === state), [municipalitiesList, state]);
  const selectedAddressMun = useMemo(() => (addressMunicipalityId ? municipalitiesList.find((m) => m.id === addressMunicipalityId) : null), [municipalitiesList, addressMunicipalityId]);

  useEffect(() => { if (selectedAddressMun) setIbgeCodeDisplay(selectedAddressMun.ibgeCode ?? ''); else setIbgeCodeDisplay(''); }, [selectedAddressMun]);
  useEffect(() => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    fetchByCep(cep).then((res) => { if (res) { setRua(res.logradouro || ''); setBairro(res.bairro || ''); } });
  }, [cep]);

  const buildAddress = () => {
    const parts = [rua, numero, bairro].filter(Boolean);
    if (selectedAddressMun) parts.push(selectedAddressMun.name, state);
    const formattedCep = formatCepForAddress(cep);
    if (formattedCep) parts.push(formattedCep);
    return parts.join(', ') || '';
  };

  const toggleMunicipality = (mid: string) => {
    setMunicipalityIds((prev) =>
      prev.includes(mid) ? prev.filter((id) => id !== mid) : [...prev, mid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome completo.');
      return;
    }
    const cpfDigits = normalizeCpfDigits(cpf);
    if (!cpfDigits) {
      toast.error('Informe o CPF.');
      return;
    }
    if (!employeeId.trim()) {
      toast.error('Informe o ID funcionário.');
      return;
    }
    if (municipalityIds.length === 0) {
      toast.error('Selecione ao menos um município de atuação.');
      return;
    }
    if (!licenseNumber.trim()) {
      toast.error('Informe o número da CNH.');
      return;
    }
    if (!licenseCategory) {
      toast.error('Selecione a categoria da CNH.');
      return;
    }
    if (!licenseExpiry) {
      toast.error('Informe o vencimento da CNH.');
      return;
    }

    const driver: Omit<Driver, 'id'> = {
      name: name.trim(),
      cpf: cpfDigits,
      employeeId: employeeId.trim(),
      address: buildAddress(),
      phone: unmaskDigits(phone) || '',
      email: email.trim() || '',
      municipalityIds: [...municipalityIds],
      licenseNumber: licenseNumber.trim(),
      licenseCategory,
      licenseExpiry,
      status: 'active',
    };
    try {
      await addDriver(driver);
      toast.success('Motorista cadastrado.');
      navigate('/operacao/motoristas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar motorista.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/operacao/motoristas" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Novo Motorista</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome completo *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João da Silva" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>CPF *</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>ID Funcionário *</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Ex.: FUNC001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Estado (UF) do endereço</label>
            <select value={state} onChange={(e) => { setState(e.target.value); setAddressMunicipalityId(''); }} className={inputClass}>{UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
          </div>
          <div>
            <label className={labelClass}>Município do endereço</label>
            <select value={addressMunicipalityId} onChange={(e) => setAddressMunicipalityId(e.target.value)} className={inputClass}><option value="">Selecione</option>{municipalitiesByState.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
          <div><label className={labelClass}>Código IBGE</label><input type="text" value={ibgeCodeDisplay} readOnly className={inputClass + ' bg-white/5 cursor-not-allowed'} /></div>
          <div><label className={labelClass}>CEP</label><input type="text" value={cep} onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000-000" className={inputClass} /></div>
          <div><label className={labelClass}>Rua</label><input type="text" value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} /></div>
          <div><label className={labelClass}>Bairro</label><input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Preenchido pelo CEP" className={inputClass} /></div>
          <div><label className={labelClass}>Número</label><input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 100" className={inputClass} /></div>
          <div className="sm:col-span-2 text-xs text-urban-gray-data">Endereço montado: {buildAddress() || '—'}</div>
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
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Município(s) de atuação *</label>
            <div className="mt-2 flex flex-wrap gap-3 rounded-lg bg-white/5 border border-urban-petrol/30 p-3 max-h-40 overflow-y-auto">
              {municipalitiesList.map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm text-urban-gray-light">
                  <input
                    type="checkbox"
                    checked={municipalityIds.includes(m.id)}
                    onChange={() => toggleMunicipality(m.id)}
                    className="rounded border-urban-petrol/50 text-urban-green focus:ring-urban-green"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Número CNH *</label>
            <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="Ex.: SP12345678" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Categoria CNH *</label>
            <select value={licenseCategory} onChange={(e) => setLicenseCategory(e.target.value)} className={inputClass}>
              <option value="">Selecione</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Vencimento CNH *</label>
            <DateInput value={licenseExpiry} onChange={setLicenseExpiry} className={inputClass} />
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">Cadastrar motorista</button>
          <Link to="/operacao/motoristas" className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
