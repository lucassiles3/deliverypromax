import type { OpeningHours, DayHours } from "@/data/stores";

const DAY_KEYS: (keyof OpeningHours)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS: Record<keyof OpeningHours, string> = {
  sun: "Dom", mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb",
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const isStoreOpen = (hours?: OpeningHours, now: Date = new Date()): boolean => {
  if (!hours) return true;
  const today = hours[DAY_KEYS[now.getDay()]];
  if (!today) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const open = toMin(today.open);
  const close = toMin(today.close);
  // Handles overnight (e.g. 18:00 → 02:00)
  if (close <= open) return cur >= open || cur < close;
  return cur >= open && cur < close;
};

export const nextOpeningLabel = (hours?: OpeningHours, now: Date = new Date()): string => {
  if (!hours) return "";
  for (let i = 1; i <= 7; i++) {
    const idx = (now.getDay() + i) % 7;
    const d = hours[DAY_KEYS[idx]];
    if (d) return `Abre ${DAY_LABELS[DAY_KEYS[idx]]} às ${d.open}`;
  }
  return "Temporariamente fechada";
};

export const formatHoursList = (hours?: OpeningHours): { day: string; range: string }[] => {
  if (!hours) return [];
  return DAY_KEYS.map((k) => ({
    day: DAY_LABELS[k],
    range: hours[k] ? `${hours[k]!.open} – ${hours[k]!.close}` : "Fechado",
  }));
};
