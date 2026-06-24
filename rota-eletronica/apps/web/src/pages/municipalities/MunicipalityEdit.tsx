import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { DateInput } from '@/components/forms/DateInput';
import { fetchMunicipiosByUf, type MunicipioIbge } from '@/services/ibgeService';
import { geocodeMunicipalityCenter } from '@/services/geocodeService';
import { api } from '@/services/api';
import { getContractExpiryWarning } from '@/utils/contractExpiry';
import { resolvePublicAssetUrl } from '@/utils/publicAssetUrl';
import type { Municipality } from '@rota-eletronica/shared-types';
import { maskPhone, unmaskDigits } from '@rota-eletronica/shared-utils';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
const labelClass = 'block text-xs text-urban-gray-data mb-1';

export function MunicipalityEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getMunicipalityById = useMunicipalitiesStore((s) => s.getMunicipalityById);
  const updateMunicipality = useMunicipalitiesStore((s) => s.updateMunicipality);
  const municipality = id ? getMunicipalityById(id) : undefined;

  const [state, setState] = useState('SP');
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
  const [status, setStatus] = useState<Municipality['status']>('active');
  const [brasaoFile, setBrasaoFile] = useState<File | null>(null);
  const [brasaoFilePreview, setBrasaoFilePreview] = useState<string | null>(null);
  const [brasaoUploading, setBrasaoUploading] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [newContractStart, setNewContractStart] = useState('');
  const [newContractEnd, setNewContractEnd] = useState('');

  const expiryWarning = municipality ? getContractExpiryWarning(municipality.contractEnd) : null;
  const isContractExpired = expiryWarning?.severity === 'expired';

  useEffect(() => {
    if (municipality) {
      setState(municipality.state);
      setResponsible(municipality.responsible);
      setResponsibleRole(municipality.responsibleRole ?? '');
      setPhone(maskPhone(String(municipality.phone ?? '')));
      setEmail(municipality.email || '');
      setContractStart(municipality.contractStart || '');
      setContractEnd(municipality.contractEnd || '');
      setStatus(municipality.status);
      if (municipality.coordinates) {
        setCenterLat(String(municipality.coordinates.lat));
        setCenterLng(String(municipality.coordinates.lng));
      } else {
        setCenterLat('');
        setCenterLng('');
      }
    }
  }, [municipality]);

  useEffect(() => {
    if (!state) {
      setMunicipiosIbge([]);
      setSelectedMunicipio(null);
      return;
    }
    setLoadingMunicipios(true);
    fetchMunicipiosByUf(state)
      .then((list) => {
        setMunicipiosIbge(list);
        if (municipality) {
          const match =
            list.find((m) => m.id === municipality.ibgeCode || m.id === String(municipality.ibgeCode)) ??
            list.find((m) => m.nome === municipality.name);
          setSelectedMunicipio(match ?? null);
        }
      })
      .finally(() => setLoadingMunicipios(false));
  }, [state, municipality?.id]);

  useEffect(() => {
    if (!brasaoFile) {
      setBrasaoFilePreview(null);
      return;
    }
    const u = URL.createObjectURL(brasaoFile);
    setBrasaoFilePreview(u);
    return () => URL.revokeObjectURL(u);
  }, [brasaoFile]);

  useEffect(() => {
    if (!selectedMunicipio || !state) return;
    setLoadingCenter(true);
    geocodeMunicipalityCenter(selectedMunicipio.nome, state)
      .then((res) => {
        if (res) {
          setCenterLat(String(res.lat));
          setCenterLng(String(res.lng));
        }
      })
      .finally(() => setLoadingCenter(false));
  }, [selectedMunicipio, state]);

  const handleStateChange = (uf: string) => {
    setState(uf);
    setSelectedMunicipio(null);
    setCenterLat('');
    setCenterLng('');
  };

  const handleBrasaoUpload = async () => {
    if (!id || !brasaoFile) {
      toast.error('Selecione um arquivo (SVG, JPG, PNG ou WebP).');
      return;
    }
    setBrasaoUploading(true);
    try {
      const { municipality: m } = await api.municipalities.uploadBrasao(id, brasaoFile);
      const next = m as Municipality;
      useMunicipalitiesStore.setState((s) => ({
        items: s.items.map((it) => (it.id === next.id ? next : it)),
      }));
      setBrasaoFile(null);
      toast.success('Brasão enviado e salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar o brasão.');
    } finally {
      setBrasaoUploading(false);
    }
  };

  const handleOpenRenew = () => {
    setNewContractStart('');
    setNewContractEnd('');
    setShowRenewModal(true);
  };

  const handleConfirmRenew = async () => {
    if (!municipality) return;
    if (!newContractStart.trim() || !newContractEnd.trim()) {
      toast.error('Informe o início e o fim do novo contrato.');
      return;
    }
    const start = new Date(newContractStart);
    const end = new Date(newContractEnd);
    if (end < start) {
      toast.error('A data de fim deve ser posterior à data de início.');
      return;
    }
    const history = [...(municipality.contractHistory ?? [])];
    history.push({
      contractStart: municipality.contractStart,
      contractEnd: municipality.contractEnd,
    });
    const updated: Municipality = {
      ...municipality,
      contractStart: newContractStart,
      contractEnd: newContractEnd,
      contractHistory: history,
    };
    try {
      await updateMunicipality(updated);
      setContractStart(newContractStart);
      setContractEnd(newContractEnd);
      toast.success('Novo contrato registrado.');
      setShowRenewModal(false);
    } catch {
      toast.error('Erro ao atualizar contrato.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !municipality) return;
    if (!selectedMunicipio) {
      toast.error('Selecione o Estado e o Município.');
      return;
    }
    if (!responsible.trim()) {
      toast.error('Informe o responsável.');
      return;
    }
    const latNum = centerLat ? parseFloat(centerLat.replace(',', '.')) : undefined;
    const lngNum = centerLng ? parseFloat(centerLng.replace(',', '.')) : undefined;
    const coordinates =
      latNum != null && lngNum != null && !Number.isNaN(latNum) && !Number.isNaN(lngNum)
        ? { lat: latNum, lng: lngNum }
        : municipality.coordinates;

    const updated: Municipality = {
      ...municipality,
      name: selectedMunicipio.nome,
      state,
      ibgeCode: selectedMunicipio.id,
      coordinates,
      responsible: responsible.trim(),
      responsibleRole: responsibleRole.trim() || '-',
      phone: unmaskDigits(phone) || '-',
      email: email.trim() || '-',
      contractStart: isContractExpired ? municipality.contractStart : (contractStart || municipality.contractStart),
      contractEnd: isContractExpired ? municipality.contractEnd : (contractEnd || municipality.contractEnd),
      contractHistory: municipality.contractHistory,
      totalStudents: municipality.totalStudents ?? 0,
      totalVehicles: municipality.totalVehicles ?? 0,
      totalRoutes: municipality.totalRoutes ?? 0,
      status,
    };
    try {
      await updateMunicipality(updated);
      toast.success('Município atualizado.');
      navigate(`/municipios/${id}`);
    } catch {
      toast.error('Erro ao atualizar município.');
    }
  };

  if (!municipality) {
    return (
      <div className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Município não encontrado.{' '}
        <Link to="/municipios" className="text-urban-green hover:underline">Voltar à listagem</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Link to="/municipios" className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Editar Município</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">
          Dados do município
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg border border-urban-petrol/30 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-medium text-urban-gray-light">Brasão do município</p>
            <p className="text-xs text-urban-gray-data">
              Envie um arquivo <strong className="text-urban-gray-light/90">SVG, JPG, PNG ou WebP</strong> (até 3&nbsp;MB). O
              arquivo fica no servidor; sem brasão, gestores/operadores continuam vendo o logo UrbanData na área logada.
            </p>
            {(brasaoFilePreview || municipality.brasaoUrl?.trim()) && (
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg border border-urban-petrol/30 bg-white overflow-hidden flex items-center justify-center p-1">
                  <img
                    src={
                      brasaoFilePreview ??
                      resolvePublicAssetUrl((municipality.brasaoUrl ?? '').trim())
                    }
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-xs text-urban-gray-data break-all">
                  {brasaoFile ? brasaoFile.name : (municipality.brasaoUrl?.trim() ?? '—')}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-urban-green/15 text-urban-green text-sm font-medium cursor-pointer hover:bg-urban-green/25 border border-urban-green/30">
                <Upload size={16} />
                Escolher arquivo
                <input
                  type="file"
                  accept=".svg,.jpg,.jpeg,.png,.webp,image/svg+xml,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setBrasaoFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                disabled={!brasaoFile || brasaoUploading}
                onClick={() => void handleBrasaoUpload()}
                className="px-3 py-2 rounded-lg bg-urban-green text-white text-sm font-medium hover:bg-urban-green-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {brasaoUploading ? 'Enviando…' : 'Enviar brasão'}
              </button>
              {brasaoFile && (
                <button
                  type="button"
                  onClick={() => setBrasaoFile(null)}
                  className="text-xs text-urban-gray-data hover:text-urban-gray-light underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>
          </div>
          <div>
            <label className={labelClass}>Estado (UF) *</label>
            <select value={state} onChange={(e) => handleStateChange(e.target.value)} className={inputClass}>
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
                const mid = e.target.value;
                setSelectedMunicipio(municipiosIbge.find((m) => m.id === mid) ?? null);
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
            <select value={status} onChange={(e) => setStatus(e.target.value as Municipality['status'])} className={inputClass}>
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
            <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome do responsável" className={inputClass} />
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="transporte@municipio.gov.br" className={inputClass} />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Contrato
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Início do contrato</label>
            <DateInput value={contractStart} onChange={setContractStart} readOnly={isContractExpired} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fim do contrato</label>
            <DateInput value={contractEnd} onChange={setContractEnd} readOnly={isContractExpired} className={inputClass} />
          </div>
          {isContractExpired && (
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={handleOpenRenew}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium"
              >
                <RefreshCw size={14} /> Renovar contrato
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button type="submit" className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors">
            Salvar alterações
          </button>
          <Link to={`/municipios/${id}`} className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors">
            Cancelar
          </Link>
        </div>
      </form>

      {showRenewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowRenewModal(false)}>
          <div className="rounded-card bg-sidebar border border-urban-petrol/30 p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-urban-gray-light font-medium mb-4">Novo contrato</h3>
            <p className="text-urban-gray-data text-sm mb-4">Informe o período do novo contrato com o município.</p>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <label className="block text-xs text-urban-gray-data mb-1">Início</label>
                <DateInput
                  value={newContractStart}
                  onChange={setNewContractStart}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
                />
              </div>
              <div>
                <label className="block text-xs text-urban-gray-data mb-1">Fim</label>
                <DateInput
                  value={newContractEnd}
                  onChange={setNewContractEnd}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light text-sm focus:outline-none focus:ring-2 focus:ring-urban-green"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenewModal(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRenew}
                className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
