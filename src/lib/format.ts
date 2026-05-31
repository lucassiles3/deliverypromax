export const brl = (n: number) =>
  `R$ ${(Number(n) || 0).toFixed(2).replace(".", ",")}`;

/**
 * Código curto e legível do pedido — 6 caracteres alfanuméricos (hex maiúsculo).
 * Usado de forma uniforme em toda a aplicação (cliente, painel, notificações,
 * recibos, exports). Aceita qualquer string (UUID, id numérico) e remove
 * caracteres não alfanuméricos.
 */
export const formatOrderCode = (id: string | null | undefined): string => {
  if (!id) return "------";
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, "");
  return clean.slice(0, 6).toUpperCase().padEnd(6, "0");
};

export const elapsed = (since: string | Date) => {
  const start = new Date(since).getTime();
  const diff = Math.max(0, Date.now() - start);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
};
