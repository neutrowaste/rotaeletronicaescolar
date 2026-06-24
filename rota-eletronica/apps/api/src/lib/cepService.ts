export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
}

const VIACEP_URL = 'https://viacep.com.br/ws';

export function cleanCep(cep: string): string {
  return cep.replace(/\D/g, '').slice(0, 8);
}

export async function fetchByCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cleanCep(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`${VIACEP_URL}/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResult & { erro?: boolean };
    if (data.erro) return null;
    return {
      cep: data.cep ?? '',
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      localidade: data.localidade ?? '',
      uf: data.uf ?? '',
      ibge: data.ibge ?? '',
    };
  } catch {
    return null;
  }
}
