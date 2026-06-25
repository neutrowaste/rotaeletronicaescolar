import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UsuarioPerfil, UsuarioStatus } from '../node_modules/.prisma/api-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const login = 'tiago';
  const rawPassword = 'mudar@123';
  const cpf = '52998224720'; // CPF fictício único
  const email = 'tiago@urbandata.local';

  const existing = await prisma.usuario.findFirst({
    where: {
      OR: [
        { login },
        { cpf },
        { email }
      ]
    }
  });

  if (existing) {
    console.log(`Usuário com login '${login}', CPF ou e-mail já existe. Atualizando dados e senha para '${rawPassword}'...`);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    await prisma.usuario.update({
      where: { id: existing.id },
      data: {
        nomeCompleto: 'Tiago Administrador',
        login,
        cpf,
        email,
        passwordHash,
        perfil: UsuarioPerfil.ADMIN,
        status: UsuarioStatus.ATIVO
      }
    });
    console.log('Senha e perfil de administrador atualizados com sucesso.');
    return;
  }

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await prisma.usuario.create({
    data: {
      nomeCompleto: 'Tiago Administrador',
      cpf,
      email,
      telefone: '11999999999',
      login,
      passwordHash,
      perfil: UsuarioPerfil.ADMIN,
      status: UsuarioStatus.ATIVO,
      deveTrocarSenha: false,
    }
  });

  console.log(`Usuário administrador '${login}' criado com sucesso com a senha: ${rawPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
