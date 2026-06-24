import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { DateInput } from '@/components/forms/DateInput';
import { fetchMunicipiosByUf, type MunicipioIbge } from '@/services/ibgeService';
import { geocodeMunicipalityCenter } from '@/services/geocodeService';
import { api } from '@/services/api';
import type { Municipality } from '@rota-eletronica/shared-types';
import { maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function MunicipalityCreate() {
  const navigate = useNavigate();
  const addMunicipality = useMunicipalitiesStore((s) => s.addMunicipality);

  // UF no cadastro começa sem seleção para mostrar "Selecionar"
  const [state, setState] = useState('');
  const [municipiosIbge, setMunicipiosIbge] = useState<MunicipioIbge[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioIbge | null>(null);
  const [centerLat, setCenterLat] = useState('');
  const [centerLng, setCenterLng] = useState('');
  const [loadingCenter, setLoadingCenter] = useState(false);
  const [responsible, setResponsible] = useState('');
  const [responsibleRole, setResponsibleRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [status, setStatus] = useState<'' | Municipality['status']>('');
  const [pendingBrasaoFile, setPendingBrasaoFile] = useState<File | null>(null);
  const [pendingBrasaoPreview, setPendingBrasaoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!state) {
      setMunicipiosIbge([]);
      setSelectedMunicipio(null);
      setCenterLat('');
      setCenterLng('');
      return;
    }
    setLoadingMunicipios(true);
    setSelectedMunicipio(null);
    setCenterLat('');
    setCenterLng('');
    fetchMunicipiosByUf(state)
      .then(setMunicipiosIbge)
      .finally(() => setLoadingMunicipios(false));
  }, [state]);

  useEffect(() => {
    if (!selectedMunicipio || !state) {
      setCenterLat('');
      setCenterLng('');
      return;
    }
    setLoadingCenter(true);
    geocodeMunicipalityCenter(selectedMunicipio.nome, state)
      .then((res) => {
        if (res) {
          setCenterLat(String(res.lat));
          setCenterLng(String(res.lng));
        } else {
          setCenterLat('');
          setCenterLng('');
        }
      })
      .finally(() => setLoadingCenter(false));
  }, [selectedMunicipio, state]);

  useEffect(() => {
    if (!pendingBrasaoFile) {
      setPendingBrasaoPreview(null);
      return;
    }
    const u = URL.createObjectURL(pendingBrasaoFile);
    setPendingBrasaoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [pendingBrasaoFile]);

  const handleStateChange = (uf: string) => {
    setState(uf);
    setSelectedMunicipio(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMunicipio) {
      toast.error('Selecione o Estado e o Município.');
      return;
    }
    if (!responsible.trim()) {
      toast.error('Informe o responsável.');
      return;
    }
    if (!status) {
      toast.error('Selecione o status.');
      return;
    }
    if (!pendingBrasaoFile) {
      toast.error('Envie o brasão do município (SVG, JPG, PNG ou WebP).');
      return;
    }
    const latNum = centerLat ? parseFloat(centerLat.replace(',', '.')) : undefined;
    const lngNum = centerLng ? parseFloat(centerLng.replace(',', '.')) : undefined;
    const coordinates =
      latNum != null && lngNum != null && !Number.isNaN(latNum) && !Number.isNaN(lngNum)
        ? { lat: latNum, lng: lngNum }
        : undefined;

    const municipality = {
      name: selectedMunicipio.nome,
      state,
      ibgeCode: selectedMunicipio.id,
      coordinates,
      responsible: responsible.trim(),
      responsibleRole: responsibleRole.trim() || '-',
      phone: unmaskDigits(phone) || '-',
      email: email.trim() || '-',
      contractStart: contractStart || new Date().toISOString().slice(0, 10),
      contractEnd: contractEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      totalStudents: 0,
      totalVehicles: 0,
      totalRoutes: 0,
      status: status as Municipality['status'],
      brasaoUrl: null,
    };
    try {
      const created = await addMunicipality(municipality as Municipality);
      try {
        const { municipality: m } = await api.municipalities.uploadBrasao(created.id, pendingBrasaoFile);
        const next = m as Municipality;
        useMunicipalitiesStore.setState((s) => ({
          items: s.items.map((it) => (it.id === next.id ? next : it)),
        }));
        toast.success('Município cadastrado com brasão.');
        navigate(`/municipios/${created.id}`);
      } catch (upErr) {
        toast.error(
          upErr instanceof Error
            ? `${upErr.message} Use Editar município para enviar o brasão.`
            : 'Não foi possível enviar o brasão. Use Editar município para tentar de novo.'
        );
        navigate(`/municipios/editar/${created.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar município.';
      toast.error(msg);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
  const labelClass = 'block text-xs text-urban-gray-data mb-1';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Link
          to="/municipios"
          className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Novo Município</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">
          Dados do município
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg border border-urban-petrol/30 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-medium text-urban-gray-light">
              Brasão do município <span className="text-red-400">*</span>
            </p>
            <p className="text-xs text-urban-gray-data">
              Obrigatório no cadastro: SVG, JPG, PNG ou WebP (até 3&nbsp;MB). O envio ocorre ao salvar. Sem brasão,
              gestores/operadores veem o logo UrbanData no sistema.
            </p>
            {pendingBrasaoPreview && (
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg border border-urban-petrol/30 bg-white overflow-hidden flex items-center justify-center p-1">
                  <img src={pendingBrasaoPreview} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <span className="text-xs text-urban-gray-data break-all">{pendingBrasaoFile?.name ?? '—'}</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-urban-green/15 text-urban-green text-sm font-medium cursor-pointer hover:bg-urban-green/25 border border-urban-green/30 w-fit">
              <Upload size={16} />
              Escolher arquivo
              <input
                type="file"
                accept=".svg,.jpg,.jpeg,.png,.webp,image/svg+xml,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  setPendingBrasaoFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            {pendingBrasaoFile && (
              <button
                type="button"
                onClick={() => setPendingBrasaoFile(null)}
                className="block text-xs text-urban-gray-data hover:text-urban-gray-light underline"
              >
                Remover arquivo e escolher outro
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Estado (UF) *</label>
            <select
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecionar</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Município *</label>
            <select
              value={selectedMunicipio?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                const mun = municipiosIbge.find((m) => m.id === id) ?? null;
                setSelectedMunicipio(mun);
              }}
              disabled={loadingMunicipios || municipiosIbge.length === 0}
              className={inputClass}
            >
              <option value="">
                {loadingMunicipios ? 'Carregando...' : municipiosIbge.length === 0 ? 'Selecione o estado' : 'Selecione'}
              </option>
              {municipiosIbge.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Código IBGE</label>
            <input
              type="text"
              value={selectedMunicipio?.id ?? ''}
              readOnly
              placeholder="Preenchido pela seleção do município"
              className={inputClass + ' bg-white/5 cursor-not-allowed'}
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => {
                const v = e.target.value;
                setStatus(v === '' ? '' : (v as Municipality['status']));
              }}
              className={inputClass}
            >
              <option value="">Selecionar</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Latitude (centro do município)</label>
            <input
              type="text"
              inputMode="decimal"
              value={centerLat}
              readOnly
              placeholder={loadingCenter ? 'Buscando...' : 'Preenchido automaticamente'}
              className={inputClass + ' bg-white/5 cursor-not-allowed'}
            />
          </div>
          <div>
            <label className={labelClass}>Longitude (centro do município)</label>
            <input
              type="text"
              inputMode="decimal"
              value={centerLng}
              readOnly
              placeholder={loadingCenter ? 'Buscando...' : 'Preenchido automaticamente'}
              className={inputClass + ' bg-white/5 cursor-not-allowed'}
            />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Contato
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Responsável *</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nome do responsável"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cargo/Função</label>
            <input
              type="text"
              value={responsibleRole}
              onChange={(e) => setResponsibleRole(e.target.value)}
              placeholder="Cargo ou função"
              className={inputClass}
            />
          </div>
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="transporte@municipio.gov.br"
              className={inputClass}
            />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Contrato
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Início do contrato</label>
            <DateInput value={contractStart} onChange={setContractStart} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fim do contrato</label>
            <DateInput value={contractEnd} onChange={setContractEnd} className={inputClass} />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            Cadastrar município
          </button>
          <Link
            to="/municipios"
            className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
