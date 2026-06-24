import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { DateInput } from '@/components/forms/DateInput';
import type { Vehicle } from '@rota-eletronica/shared-types';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'inactive', label: 'Inativo' },
];
const TRANSPORT_TYPE_OPTIONS = [
  { value: 'escolar', label: 'Escolar' },
  { value: 'saude', label: 'Saúde' },
  { value: 'nao_informado', label: 'Não informado' },
];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 20 }, (_, i) => currentYear - i);

export function VehicleCreate() {
  const navigate = useNavigate();
  const addVehicle = useVehiclesStore((s) => s.addVehicle);
  const garagesList = useGaragesStore((s) => s.items);
  const municipalitiesList = useMunicipalitiesStore((s) => s.items);

  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number>(currentYear);
  const [color, setColor] = useState('');
  const [capacity, setCapacity] = useState<number>(44);
  const [municipalityId, setMunicipalityId] = useState('');
  const [garageId, setGarageId] = useState('');
  const [transportType, setTransportType] = useState<Vehicle['transportType']>('nao_informado');
  const [renavam, setRenavam] = useState('');
  const [chassis, setChassis] = useState('');
  const [lastInspectionDate, setLastInspectionDate] = useState('');
  const [status, setStatus] = useState<Vehicle['status']>('active');

  const garagesInMun = useMemo(
    () => (municipalityId ? garagesList.filter((g) => g.municipalityId === municipalityId) : []),
    [municipalityId]
  );

  const handleMunicipalityChange = (munId: string) => {
    setMunicipalityId(munId);
    setGarageId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) {
      toast.error('Informe a placa do veículo.');
      return;
    }
    if (!municipalityId) {
      toast.error('Selecione o município.');
      return;
    }
    if (!garageId) {
      toast.error('Selecione a garagem.');
      return;
    }

    const vehicle: Omit<Vehicle, 'id'> = {
      plate: plate.trim().toUpperCase(),
      brand: brand.trim() || '-',
      model: model.trim() || '-',
      year,
      color: color.trim() || '-',
      capacity,
      municipalityId,
      garageId,
      transportType: transportType ?? 'nao_informado',
      driverResponsible: '',
      renavam: renavam.trim() || '-',
      chassis: chassis.trim() || '-',
      lastInspectionDate: lastInspectionDate || new Date().toISOString().slice(0, 10),
      status,
      routesCount: 0,
    };
    try {
      await addVehicle(vehicle);
      toast.success('Veículo cadastrado.');
      navigate('/veiculos');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar veículo.');
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-white/5 border border-urban-petrol/50 text-urban-gray-light placeholder-urban-gray-data focus:outline-none focus:ring-2 focus:ring-urban-green text-sm';
  const labelClass = 'block text-xs text-urban-gray-data mb-1';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Link
          to="/veiculos"
          className="flex items-center gap-2 text-urban-gray-data hover:text-urban-green"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-urban-gray-light">Novo Veículo</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-card bg-sidebar/80 border border-urban-petrol/30 p-6 space-y-6">
        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2">
          Dados do veículo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Placa *</label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC-1234"
              className={inputClass}
              maxLength={8}
            />
          </div>
          <div>
            <label className={labelClass}>Marca</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ex.: Mercedes-Benz, Marcopolo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Modelo</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex.: OF-1519, Volare W9"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ano</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={inputClass}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Cor</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ex.: Amarelo, Branco"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Capacidade (lugares)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 44)}
              className={inputClass}
            />
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Município, garagem e tipo de transporte
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Município *</label>
            <select
              value={municipalityId}
              onChange={(e) => handleMunicipalityChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione o município</option>
              {municipalitiesList.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Garagem *</label>
            <select
              value={garageId}
              onChange={(e) => setGarageId(e.target.value)}
              disabled={!municipalityId}
              className={inputClass}
            >
              <option value="">Selecione a garagem</option>
              {garagesInMun.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipo de transporte</label>
            <select
              value={transportType ?? 'nao_informado'}
              onChange={(e) => setTransportType(e.target.value as Vehicle['transportType'])}
              className={inputClass}
            >
              {TRANSPORT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="text-urban-gray-light font-medium text-sm border-b border-urban-petrol/30 pb-2 pt-2">
          Documentação
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>RENAVAM</label>
            <input
              type="text"
              value={renavam}
              onChange={(e) => setRenavam(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="11 dígitos"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Chassis</label>
            <input
              type="text"
              value={chassis}
              onChange={(e) => setChassis(e.target.value)}
              placeholder="Número do chassi"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Última inspeção</label>
            <DateInput value={lastInspectionDate} onChange={setLastInspectionDate} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Vehicle['status'])}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-urban-petrol/30">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white font-medium transition-colors"
          >
            Cadastrar veículo
          </button>
          <Link
            to="/veiculos"
            className="px-4 py-2 rounded-lg bg-white/10 text-urban-gray-light hover:bg-white/20 font-medium transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
