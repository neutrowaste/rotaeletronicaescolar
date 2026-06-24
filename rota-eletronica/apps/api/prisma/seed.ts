import 'dotenv/config';

/**
 * Seed opcional: não cria mais usuário automático (admin@urbandata.com).
 * Com a tabela vazia, use a tela "Primeiro acesso" no login ou POST /api/auth/bootstrap.
 */
async function main() {
  console.log(
    'Seed: nenhum usuário web é criado automaticamente. Cadastre o primeiro gestor pela tela de primeiro acesso (se o sistema estiver sem usuários) ou via API /api/auth/bootstrap.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
