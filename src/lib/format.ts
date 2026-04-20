export const brl = (n: number) =>
  `R$ ${(Number(n) || 0).toFixed(2).replace(".", ",")}`;

export const elapsed = (since: string | Date) => {
  const start = new Date(since).getTime();
  const diff = Math.max(0, Date.now() - start);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
};
