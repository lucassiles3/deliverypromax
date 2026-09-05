const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_KEYS_FULL = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Verifica se o estabelecimento está aberto agora, dado um mapa de opening_hours. */
export function isOpenNow(
  hours: Record<string, any> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!hours || typeof hours !== "object" || Object.keys(hours).length === 0) return true;

  const dayIndex = now.getDay();
  const shortKey = DAY_KEYS[dayIndex];
  const fullKey = DAY_KEYS_FULL[dayIndex];

  const today: any = hours[shortKey] ?? hours[fullKey];
  if (!today) return false;

  let openStr: string | undefined;
  let closeStr: string | undefined;

  if (typeof today === "object") {
    if (today.closed) return false;
    openStr = today.open;
    closeStr = today.close;
  } else if (typeof today === "string") {
    if (today.includes("-")) {
      const parts = today.split("-").map((s) => s.trim());
      openStr = parts[0];
      closeStr = parts[1];
    }
  }

  if (!openStr || !closeStr) return false;

  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = openStr.split(":").map(Number);
  const [ch, cm] = closeStr.split(":").map(Number);
  const openMin = (oh || 0) * 60 + (om || 0);
  const closeMin = (ch || 0) * 60 + (cm || 0);

  // suporta janela que cruza meia-noite (ex: 18:00 -> 02:00)
  if (closeMin <= openMin) {
    return cur >= openMin || cur <= closeMin;
  }
  return cur >= openMin && cur <= closeMin;
}
