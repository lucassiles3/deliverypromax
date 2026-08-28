const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

type DayHours = { open?: string; close?: string; closed?: boolean };

/** Verifica se o estabelecimento está aberto agora, dado um mapa de opening_hours. */
export function isOpenNow(
  hours: Record<string, DayHours> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!hours || Object.keys(hours).length === 0) return true;
  const key = DAY_KEYS[now.getDay()];
  const today = hours[key];
  if (!today || today.closed) return false;
  const open = today.open;
  const close = today.close;
  if (!open || !close) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const openMin = oh * 60 + (om || 0);
  let closeMin = ch * 60 + (cm || 0);
  // suporta janela que cruza meia-noite (ex: 18:00 -> 02:00)
  if (closeMin <= openMin) {
    return cur >= openMin || cur <= closeMin;
  }
  return cur >= openMin && cur <= closeMin;
}
