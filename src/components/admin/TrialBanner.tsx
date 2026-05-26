import { Sparkles, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  state?: { state?: string; trial_days_left?: number; plan_price?: number; current_period_end?: string | null } | null;
  onSubscribe: () => void;
};

export const TrialBanner = ({ state, onSubscribe }: Props) => {
  if (!state) return null;
  const s = state.state;
  const price = 150;

  if (s === "active" || s === "cancelled_active") {
    const ends = state.current_period_end ? new Date(state.current_period_end) : null;
    const cancelled = s === "cancelled_active";
    return (
      <div className={`border-b ${cancelled ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20"}`}>
        <div className="container flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cancelled ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
              {cancelled ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
            <div className="leading-tight">
              <p className="font-bold">{cancelled ? "Assinatura cancelada" : "Plano PRO ativo"}</p>
              <p className="text-xs text-muted-foreground">
                {cancelled ? "Acesso até " : "Renova em "}
                {ends ? ends.toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onSubscribe} className="self-start sm:self-auto">
            Gerenciar assinatura
          </Button>
        </div>
      </div>
    );
  }

  if (s !== "trial") return null;

  const days = state.trial_days_left ?? 0;
  const urgent = days <= 2;

  return (
    <div
      className={`border-b ${
        urgent
          ? "bg-gradient-to-r from-destructive/15 via-destructive/10 to-destructive/15 border-destructive/30"
          : "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20"
      }`}
    >
      <div className="container flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 text-sm">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              urgent ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
            }`}
          >
            <Clock className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="font-bold">
              {days > 0
                ? `Período de teste: ${days} ${days === 1 ? "dia restante" : "dias restantes"}`
                : "Seu teste termina hoje"}
            </p>
            <p className="text-xs text-muted-foreground">
              Assine o plano PRO por R$ {price.toFixed(2).replace(".", ",")}/mês e continue com a loja ativa.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onSubscribe} className="gap-1.5 self-start sm:self-auto">
          <Sparkles className="h-4 w-4" />
          Assinar PRO
        </Button>
      </div>
    </div>
  );
};
