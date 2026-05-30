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

  // Quando o plano está ativo, não mostramos banner — fica limpo no topo do painel.
  if (s === "active") return null;

  if (s === "cancelled_active") {
    const ends = state.current_period_end ? new Date(state.current_period_end) : null;
    return (
      <div className="border-b bg-warning/10 border-warning/30">
        <div className="container flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
              <XCircle className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="font-bold">Assinatura cancelada</p>
              <p className="text-xs text-muted-foreground">
                Acesso até {ends ? ends.toLocaleDateString("pt-BR") : "—"}
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
