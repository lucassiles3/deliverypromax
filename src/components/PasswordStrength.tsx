import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

export const PasswordStrength = ({ password }: Props) => {
  const rules = [
    { label: "Mínimo de 6 caracteres", test: (p: string) => p.length >= 6 },
    { label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Um número", test: (p: string) => /\d/.test(p) },
    { label: "Um caractere especial (!@#$...)", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_+\-=\\[\\];'`~]/.test(p) },
  ];

  const passed = rules.filter((r) => r.test(password)).length;

  let level = "Fraca";
  let color = "text-destructive";
  let barColor = "bg-destructive";

  if (passed === rules.length) {
    level = "Forte";
    color = "text-emerald-500";
    barColor = "bg-emerald-500";
  } else if (passed >= 3) {
    level = "Média";
    color = "text-amber-500";
    barColor = "bg-amber-500";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Força da senha</span>
        <span className={`text-sm font-bold ${color}`}>{level}</span>
      </div>
      <div className="flex gap-1">
        {rules.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < passed ? barColor : "bg-muted"}`}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {rules.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-2 text-xs">
              {ok ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={ok ? "text-emerald-500" : "text-muted-foreground"}>
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
