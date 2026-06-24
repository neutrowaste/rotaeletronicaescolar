import { useRef, useState, useEffect } from 'react';
import { useAuthStore, mapApiUserToWebUser } from '@/store/authStore';
import { api } from '@/services/api';
import {
  Building2,
  Camera,
  Folder,
  IdCard,
  Mail,
  MapPin,
  Shield,
  Trash2,
  User,
  UserCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { maskCpf } from '@rota-eletronica/shared-utils';
import { isAdminRole } from '@/utils/permissoes';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
  admin: 'Gestor',
  gestor: 'Gestor',
  operador: 'Operador',
};

/** Rótulo curto do setor no perfil (abaixo de “Setor”). */
const SETOR_PERFIL_LABELS: Record<string, string> = {
  SETOR_TRANSPORTE: 'Transporte',
  SETOR_MAPAS: 'Mapas',
  SETOR_EDUCACAO: 'Educação',
};

function setorExibicaoNoPerfil(user: { role: string; setorUnidade?: string | null }): string {
  const r = String(user.role ?? '').toUpperCase();
  if (r === 'ADMIN' || user.role === 'admin') return 'Administrador';
  const s = user.setorUnidade;
  if (s && SETOR_PERFIL_LABELS[s]) return SETOR_PERFIL_LABELS[s]!;
  if (s) return s;
  return '—';
}

/** Texto de municípios de atuação (alinhado ao detalhe de usuário / regra de admin “todos”). */
function municipioAtuacaoNoPerfil(user: {
  role: string;
  ufAtuacao?: string | null;
  municipalityIds?: string[];
  municipios?: Array<{ name: string; state: string }>;
}): string {
  const comNome = (user.municipios ?? []).filter((m) => m.name);
  if (comNome.length > 0) {
    return comNome.map((m) => `${m.name} (${m.state})`).join(', ');
  }
  if (isAdminRole(user.role) && (!user.municipalityIds || user.municipalityIds.length === 0)) {
    return 'Todos os municípios';
  }
  if (user.ufAtuacao) {
    return `UF ${user.ufAtuacao} — sem município vinculado`;
  }
  return 'Nenhuma cidade vinculada';
}

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const applySession = useAuthStore((s) => s.applySession);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user?.photo !== undefined) setPhotoUrl(user.photo ?? null);
  }, [user?.id, user?.photo]);

  const persistFotoPerfil = async (fotoPerfil: string | null) => {
    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }
    setSavingPhoto(true);
    try {
      const { user: u } = await api.auth.patchMe({ fotoPerfil });
      applySession(token, mapApiUserToWebUser(u));
      toast.success(fotoPerfil ? 'Foto salva no servidor.' : 'Foto removida.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a foto.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      void persistFotoPerfil(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openGallery = () => fileInputRef.current?.click();

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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    void persistFotoPerfil(dataUrl);
    closeCamera();
  };

  const confirmRemovePhoto = () => {
    void persistFotoPerfil(null);
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

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-card bg-sidebar/80 border border-urban-petrol/30 p-8 text-center text-urban-gray-data">
        Faça login para ver seu perfil.
      </div>
    );
  }

  const displayAvatar = photoUrl ?? user?.photo ?? null;
  const initial = user.name.charAt(0);
  const perfilLabel = ROLE_LABELS[user.role] ?? user.role;
  const setorLabel = setorExibicaoNoPerfil(user);
  const municipioLabel = municipioAtuacaoNoPerfil(user);
  const cpfLabel = user.cpf ? maskCpf(user.cpf) : '—';

  const fieldRowClass =
    'flex items-start gap-3 p-4 rounded-lg border border-gray-200';

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="rounded-card bg-white border border-gray-200 flex-1 flex flex-col p-8 min-h-[28rem] shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-8 flex items-center gap-2 flex-wrap">
          <UserCircle size={20} className="text-urban-green shrink-0" />
          Meu perfil
          {savingPhoto && (
            <span className="text-sm font-normal text-gray-500">Salvando foto…</span>
          )}
        </h2>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Foto do perfil</h3>
          <div className="flex flex-col items-center p-4 rounded-lg border border-gray-200 gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} aria-hidden />
            <div className="w-36 h-36 rounded-full bg-urban-petrol flex items-center justify-center text-4xl font-semibold text-white overflow-hidden border-4 border-gray-200 flex-shrink-0">
              {displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="text-center">
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setShowRemovePhotoModal(true)}
                  className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium mx-auto"
                >
                  <Trash2 size={18} /> Remover foto
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openPhotoCamera}
                className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium"
              >
                <Camera size={18} /> Tirar foto
              </button>
              <span className="text-gray-500 text-sm">ou</span>
              <button
                type="button"
                onClick={openGallery}
                className="flex items-center gap-2 text-sm text-urban-green hover:underline font-medium"
              >
                <Folder size={18} /> Carregar foto
              </button>
            </div>
          </div>
        </section>

        {/* Modal confirmação remover foto */}
        {showRemovePhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-remove-photo-title">
            <div className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-5 [color:white]" onClick={(e) => e.stopPropagation()}>
              <p id="profile-remove-photo-title" className="font-medium mb-1">Deseja remover a foto?</p>
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

        {/* Modal câmera — preview circular */}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Câmera">
            <div className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-4 [color:white]" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm mb-3">Posicione o rosto no enquadramento</p>
              <div className="w-64 h-64 rounded-full mx-auto overflow-hidden bg-black border-2 border-white/20">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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

        <section className="pt-8 mt-8 border-t border-gray-200 flex-1">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Dados do cadastro
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={fieldRowClass}>
              <User size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">Nome completo</p>
              </div>
            </div>

            <div className={fieldRowClass}>
              <IdCard size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{cpfLabel}</p>
                <p className="text-sm text-gray-500">Nº do documento (CPF)</p>
              </div>
            </div>

            <div className={fieldRowClass}>
              <MapPin size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 leading-snug">{municipioLabel}</p>
                <p className="text-sm text-gray-500">Município de atuação</p>
              </div>
            </div>

            <div className={fieldRowClass}>
              <Shield size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{perfilLabel}</p>
                <p className="text-sm text-gray-500">Perfil</p>
              </div>
            </div>

            <div className={fieldRowClass}>
              <Building2 size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{setorLabel}</p>
                <p className="text-sm text-gray-500">Setor</p>
              </div>
            </div>

            <div className={fieldRowClass}>
              <Mail size={20} className="text-urban-green shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 break-all">{user.email}</p>
                <p className="text-sm text-gray-500">E-mail</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
