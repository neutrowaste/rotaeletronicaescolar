import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Key, Bell } from 'lucide-react';

export function Settings() {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="rounded-card bg-white border border-gray-200 flex-1 flex flex-col p-8 min-h-[28rem] shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-8 flex items-center gap-2">
          <SettingsIcon size={20} className="text-urban-green" />
          Configurações
        </h2>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Conta
          </h3>
          <Link
            to="/configuracoes/alterar-senha"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Key size={20} className="text-urban-green shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">Alterar senha</p>
              <p className="text-sm text-gray-500">Nova senha gravada com hash seguro no banco de dados</p>
            </div>
          </Link>
        </section>

        <section className="space-y-4 pt-8 mt-8 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Preferências
          </h3>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
            <Bell size={20} className="text-urban-green shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">Notificações</p>
              <p className="text-sm text-gray-500">
                Gerencie alertas e notificações do sistema
              </p>
            </div>
            <span className="text-xs text-gray-500 shrink-0">Em breve</span>
          </div>
        </section>
      </div>
    </div>
  );
}
