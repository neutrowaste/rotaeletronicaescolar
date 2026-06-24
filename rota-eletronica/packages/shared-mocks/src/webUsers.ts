import type { WebUser } from '@rota-eletronica/shared-types';

/** Usuários do sistema web - login mock (admin, operador, gestor) - USR001 para demonstração */
export const webUsers: WebUser[] = [
  {
    id: 'USR001',
    name: 'João da Silva Pereira',
    email: 'admin@urbandata.com',
    login: 'admin',
    role: 'admin',
    municipalityIds: [],
  },
  {
    id: 'USR002',
    name: 'Operador Campinas',
    email: 'operador@urbandata.com',
    login: 'operador',
    role: 'OPERADOR',
    municipalityIds: ['MUN001'],
  },
  {
    id: 'USR003',
    name: 'Gestor Regional',
    email: 'gestor@urbandata.com',
    login: 'gestor',
    role: 'GESTOR',
    municipalityIds: ['MUN001', 'MUN003'],
  },
];

/** Credenciais mock para login web (email -> senha) */
export const webCredentials: Record<string, string> = {
  'admin@urbandata.com': 'admin123',
  'operador@urbandata.com': 'op456',
  'gestor@urbandata.com': 'gest789',
};
