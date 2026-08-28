import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Gift, Sparkles, Copy, Clock, Trophy, ArrowRight, Coins } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useAllStorePoints, useLoyaltyRewards, useMyRedemptions, useRedeemReward, useStorePoints } from "@/hooks/useLoyaltyPoints";
import { brl } from "@/lib/format";
import { toast } from "sonner";

const Recompensas = () => {
  const { user, loading } = useAuth();
  const { data: storesPoints = [], isLoading: loadingStores } = useAllStorePoints();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const activeStoreId = selectedStoreId ?? storesPoints[0]?.storeId ?? null;
  const activeStore = storesPoints.find((s) => s.storeId === activeStoreId);
  const { data: rewards = [], isLoading: loadingRewards } = useLoyaltyRewards(activeStoreId ?? undefined);
  const { data: balance = 0 } = useStorePoints(activeStoreId ?? undefined);
  const { data: redemptions = [] } = useMyRedemptions();
  const redeem = useRedeemReward();

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 pb-24">
      <Header />
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold md:text-3xl">Recompensas</h1>
        </div>

        {loadingStores ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Carregando…</Card>
        ) : storesPoints.length === 0 ? (
          <Card className="p-10 text-center">
            <Coins className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-3 font-display text-xl font-bold">Você ainda não tem pontos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Faça pedidos nas lojas para acumular pontos e trocar por recompensas exclusivas.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">Ver lojas <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </Card>
        ) : (
          <>
            {/* Seletor de loja */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {storesPoints.map((s) => {
                const isActive = s.storeId === activeStoreId;
                return (
                  <button
                    key={s.storeId}
                    onClick={() => setSelectedStoreId(s.storeId)}
                    className={`flex shrink-0 snap-start items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-left transition-smooth ${
                      isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xl">{s.logo ?? "🍽️"}</span>
                    <div>
                      <div className="text-xs font-bold">{s.name}</div>
                      <div className={`text-[11px] ${isActive ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {s.balance.toLocaleString("pt-BR")} pts
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Card de saldo */}
            <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Seu saldo em {activeStore?.name}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-bold text-primary md:text-5xl">
                      {balance.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground">pontos</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    1 ponto a cada R$ 1,00 gasto · validade de 1 ano
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="h-8 w-8" />
                </div>
              </div>
            </Card>

            {/* Recompensas disponíveis */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <Gift className="h-5 w-5 text-primary" /> Trocar pontos
              </h2>
              {loadingRewards ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Carregando…</Card>
              ) : rewards.length === 0 ? (
                <Card className="border-2 border-dashed p-8 text-center">
                  <Gift className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Esta loja ainda não cadastrou recompensas.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {rewards.map((r) => {
                    const canRedeem = balance >= r.cost_points && (r.stock ?? 1) > 0;
                    return (
                      <Card key={r.id} className={`p-5 transition-smooth ${canRedeem ? "hover:shadow-glow" : "opacity-60"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-display text-base font-bold">{r.name}</h3>
                            {r.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                            )}
                            <p className="mt-2 text-xs">
                              {r.reward_type === "percent" && <>🎯 <b>{r.reward_value}% OFF</b> no próximo pedido</>}
                              {r.reward_type === "fixed" && <>💰 <b>{brl(r.reward_value)}</b> de desconto</>}
                              {r.reward_type === "free_shipping" && <>🚚 <b>Frete grátis</b> no próximo pedido</>}
                              {r.reward_type === "free_item" && <>🎁 <b>Item grátis</b></>}
                            </p>
                          </div>
                          <div className="rounded-xl bg-primary/10 px-3 py-2 text-center">
                            <div className="font-display text-lg font-bold text-primary">{r.cost_points}</div>
                            <div className="text-[10px] font-bold uppercase text-muted-foreground">pts</div>
                          </div>
                        </div>
                        {r.stock !== null && r.stock <= 5 && (
                          <p className="mt-2 text-[11px] font-bold text-amber-600">
                            ⚡ Restam apenas {r.stock} unidades
                          </p>
                        )}
                        <Button
                          onClick={() => redeem.mutate(r.id)}
                          disabled={!canRedeem || redeem.isPending}
                          className="mt-3 w-full"
                          size="sm"
                        >
                          {!canRedeem
                            ? balance < r.cost_points
                              ? `Faltam ${r.cost_points - balance} pts`
                              : "Esgotado"
                            : redeem.isPending
                              ? "Resgatando…"
                              : "Resgatar agora"}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Meus cupons resgatados */}
            {redemptions.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  <Trophy className="h-5 w-5 text-primary" /> Meus cupons
                </h2>
                <div className="grid gap-2">
                  {redemptions.map((r) => {
                    const expired = r.expires_at && new Date(r.expires_at) < new Date();
                    const status = r.status === "used" ? "used" : expired ? "expired" : "pending";
                    return (
                      <Card key={r.id} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{r.store?.logo ?? "🎁"}</span>
                            <p className="truncate text-sm font-bold">{r.reward?.name}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {r.store?.name} · {r.points_spent} pts
                          </p>
                          {r.expires_at && status === "pending" && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" /> Vale até {new Date(r.expires_at).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <code
                            className={`rounded-lg px-2 py-1 font-mono text-xs font-bold ${
                              status === "pending" ? "bg-primary/10 text-primary"
                                : status === "used" ? "bg-green-500/10 text-green-700"
                                : "bg-muted text-muted-foreground line-through"
                            }`}
                          >
                            {r.coupon_code}
                          </code>
                          {status === "pending" && (
                            <button onClick={() => copy(r.coupon_code)} className="text-[10px] text-primary hover:underline">
                              <Copy className="mr-0.5 inline h-3 w-3" /> copiar
                            </button>
                          )}
                          {status === "used" && <span className="text-[10px] font-bold text-green-700">✓ usado</span>}
                          {status === "expired" && <span className="text-[10px] text-muted-foreground">expirado</span>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Recompensas;
