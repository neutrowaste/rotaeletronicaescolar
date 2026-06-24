import { prisma } from './prisma.js';

/** Valida UF (valor igual ao campo `state` dos municípios no cadastro) e cidades da mesma UF. */
export async function validarUfEMunicipios(
  uf: string,
  municipioIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = uf.trim().toUpperCase();
  if (!u) return { ok: false, error: 'UF de atuação é obrigatória.' };
  if (municipioIds.length === 0) return { ok: false, error: 'Selecione ao menos uma cidade de atuação.' };

  const uniq = [...new Set(municipioIds.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return { ok: false, error: 'Selecione ao menos uma cidade de atuação.' };

  const muns = await prisma.municipality.findMany({ where: { id: { in: uniq } } });
  if (muns.length !== uniq.length) return { ok: false, error: 'Um ou mais municípios não foram encontrados.' };

  const states = new Set(muns.map((m) => m.state.trim().toUpperCase()));
  if (states.size !== 1) return { ok: false, error: 'Todos os municípios devem pertencer à mesma UF.' };
  const only = [...states][0];
  if (only !== u) return { ok: false, error: 'Os municípios selecionados não pertencem à UF informada.' };

  return { ok: true };
}
