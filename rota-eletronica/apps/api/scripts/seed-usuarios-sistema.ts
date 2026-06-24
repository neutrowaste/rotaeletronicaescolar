/**
 * Cria usuários de referência (ADMIN, GESTOR, OPERADOR) diretamente no banco.
 * Requer ao menos um município em `Municipality`.
 *
 * Uso (na pasta apps/api): npx tsx scripts/seed-usuarios-sistema.ts
 *
 * Senha inicial (todos): UrbanData2025!
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import {
  UsuarioPerfil,
  UsuarioStatus,
  UsuarioSetor,
} from '../node_modules/.prisma/api-client/index.js';

const DEFAULT_PASSWORD = 'UrbanData2025!';

const SEEDS: Array<{
  nomeCompleto: string;
  cpf: string;
  email: string;
  login: string;
  telefone: string;
  perfil: (typeof UsuarioPerfil)[keyof typeof UsuarioPerfil];
}> = [
  {
    nomeCompleto: 'Administrador do Sistema',
    cpf: '52998224725',
    email: 'admin.sistema@urbandata.local',
    login: 'admin',
    telefone: '11999990001',
    perfil: UsuarioPerfil.ADMIN,
  },
  {
    nomeCompleto: 'Gestor Municipal',
    cpf: '11144477735',
    email: 'gestor@urbandata.local',
    login: 'gestor',
    telefone: '11999990002',
    perfil: UsuarioPerfil.GESTOR,
  },
  {
    nomeCompleto: 'Operador Operacional',
    cpf: '86288366757',
    email: 'operador@urbandata.local',
    login: 'operador',
    telefone: '11999990003',
    perfil: UsuarioPerfil.OPERADOR,
  },
];

async function main() {
  const mun = await prisma.municipality.findFirst({ select: { id: true, name: true } });
  if (!mun) {
    throw new Error(
      'Nenhum município cadastrado. Cadastre pelo menos um município antes de rodar este script.'
    );
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const row of SEEDS) {
    const existing = await prisma.usuario.findFirst({
      where: { OR: [{ login: row.login }, { cpf: row.cpf }, { email: row.email }] },
    });
    if (existing) {
      console.log(`Pulado (já existe): ${row.login} (${row.perfil})`);
      continue;
    }

    await prisma.usuario.create({
      data: {
        nomeCompleto: row.nomeCompleto,
        cpf: row.cpf,
        email: row.email,
        telefone: row.telefone,
        login: row.login,
        passwordHash,
        perfil: row.perfil,
        status: UsuarioStatus.ATIVO,
        municipioId: mun.id,
        setorUnidade: UsuarioSetor.SETOR_TRANSPORTE,
        deveTrocarSenha: false,
      },
    });
    console.log(`Criado: ${row.login} — perfil ${row.perfil} — município ${mun.name}`);
  }

  console.log(
    `\nSenha inicial para todos os logins criados: ${DEFAULT_PASSWORD}\n` +
      '(troque após o primeiro acesso em produção.)'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
