// Lightweight client-side loyalty store (cashback + tier).
// In a real backend this would live in DB; we persist to localStorage for now.

const KEY = "ff_loyalty_v1";

export type LoyaltyState = {
  cashback: number; // R$ available
  totalSpent: number; // lifetime
  ordersCount: number;
};

const empty: LoyaltyState = { cashback: 0, totalSpent: 0, ordersCount: 0 };

export const getLoyalty = (): LoyaltyState => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
};

export const setLoyalty = (s: LoyaltyState) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("ff:loyalty"));
};

export const tierOf = (totalSpent: number): { name: string; emoji: string; next?: number } => {
  if (totalSpent >= 500) return { name: "VIP Ouro", emoji: "👑" };
  if (totalSpent >= 200) return { name: "Cliente Prata", emoji: "⭐", next: 500 };
  if (totalSpent >= 50) return { name: "Cliente Bronze", emoji: "🥉", next: 200 };
  return { name: "Novo cliente", emoji: "🌱", next: 50 };
};

export const CASHBACK_RATE = 0.05; // 5%

export const applyOrder = (orderTotal: number, cashbackUsed: number) => {
  const earned = Math.round((orderTotal - cashbackUsed) * CASHBACK_RATE * 100) / 100;
  const cur = getLoyalty();
  setLoyalty({
    cashback: Math.max(0, cur.cashback - cashbackUsed) + earned,
    totalSpent: cur.totalSpent + orderTotal,
    ordersCount: cur.ordersCount + 1,
  });
  return earned;
};
