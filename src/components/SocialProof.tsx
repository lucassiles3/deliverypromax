import { useEffect, useState } from "react";
import { Users } from "lucide-react";

const names = ["João", "Maria", "Carlos", "Ana", "Pedro", "Juliana", "Lucas", "Fernanda", "Rafael", "Camila"];
const items = ["Smash Bacon Duplo", "Pizza Pepperoni", "Combinado Zen", "Petit Gâteau", "Cheese Clássico"];

export const SocialProof = () => {
  const [activity, setActivity] = useState({ name: names[0], item: items[0], visible: false });
  const [viewers, setViewers] = useState(7);

  useEffect(() => {
    const tick = () => {
      setActivity({
        name: names[Math.floor(Math.random() * names.length)],
        item: items[Math.floor(Math.random() * items.length)],
        visible: true,
      });
      setTimeout(() => setActivity((a) => ({ ...a, visible: false })), 4500);
    };
    const t1 = setTimeout(tick, 2000);
    const t2 = setInterval(tick, 9000);
    const t3 = setInterval(() => setViewers(5 + Math.floor(Math.random() * 18)), 5000);
    return () => {
      clearTimeout(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, []);

  return (
    <>
      <div className="flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
        </span>
        <Users className="h-3.5 w-3.5" />
        {viewers} pessoas vendo agora
      </div>

      <div
        className={`fixed bottom-4 left-4 z-30 max-w-xs rounded-2xl bg-card p-3 pr-4 shadow-float transition-bounce ${
          activity.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
            {activity.name[0]}
          </div>
          <div className="text-sm">
            <strong>{activity.name}</strong> acabou de pedir
            <div className="text-xs text-muted-foreground">{activity.item}</div>
          </div>
        </div>
      </div>
    </>
  );
};
