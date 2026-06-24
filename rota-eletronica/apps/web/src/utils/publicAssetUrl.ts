/**
 * Monta URL final para arquivos em `public/` (ou URLs absolutas).
 * Corrige caminhos colados sem barra inicial, prefixo `public/` e respeita `import.meta.env.BASE_URL`.
 */
export function resolvePublicAssetUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  const withSlash = s.startsWith('/') ? s : `/${s}`;
  if (withSlash.startsWith('/uploads/')) {
    const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
    return `${apiBase}${withSlash}`;
  }
  let path = s.replace(/^\/+/, '');
  path = path.replace(/^(apps\/web\/)?public\//i, '');
  const slug = path.startsWith('/') ? path : `/${path}`;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  return base ? `${base}${slug}` : slug;
}
