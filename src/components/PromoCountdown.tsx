import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

export const PromoCountdown = () => {
  const [time, setTime] = useState(() => {
    const end = Date.now() + 1000 * 60 * 47 + 1000 * 32;
    return end;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const diff = Math.max(0, time - now);
  const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 rounded-full gradient-promo px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-glow">
      <Timer className="h-3.5 w-3.5" />
      Promo acaba em {h}:{m}:{s}
    </div>
  );
};
