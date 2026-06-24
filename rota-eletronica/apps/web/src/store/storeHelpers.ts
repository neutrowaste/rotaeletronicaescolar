/** Insere ou substitui um item na lista pelo id (mantém cache global consistente). */
export function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    const next = [...items];
    next[idx] = item;
    return next;
  }
  return [...items, item];
}
