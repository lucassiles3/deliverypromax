import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  Search,
  Crown,
  AlertTriangle,
  Sparkles,
  Repeat,
  Ban,
  ShieldCheck,
  X,
  Phone,
  Mail,
  MapPin,
  Star,
  Award,
  ShoppingBag,
  Download,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerProfileDrawer } from "./CustomerProfileDrawer";

type Segment = "new" | "recurring" | "vip" | "at_risk";
type SegmentFilter = "all" | Segment | "blocked";

const segmentCfg: Record<Segment, { label: string; cls: string; icon: typeof Crown }> = {
  new: { label: "Novo", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Sparkles },
  recurring: { label: "Recorrente", cls: "bg-primary/10 text-primary border-primary/30", icon: Repeat },
  vip: { label: "VIP", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Crown },
  at_risk: { label: "Em risco", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

const fmt = (n: number) =>
  `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const computeSegment = (firstAt: Date, lastAt: Date, count: number, totalSpent: number): Segment => {
  const now = Date.now();
  const daysSinceLast = (now - lastAt.getTime()) / 86400000;
  const daysSinceFirst = (now - firstAt.getTime()) / 86400000;
  if (daysSinceLast >= 45) return "at_risk";
  if (totalSpent >= 500) return "vip";
  if (count >= 3) return "recurring";
  if (daysSinceFirst < 30) return "new";
  return "recurring";
};

export const CustomersTab = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<SegmentFilter>("all");
  const [openProfile, setOpenProfile] = useState<string | null>(null); // phone

  // Fetch all delivered/active orders → aggregate by phone
  const { data: orders = [] } = useQuery({
    queryKey: ["crm-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, user_id, customer_name, customer_phone, total, status, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["crm-blocked", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_customers")
        .select("*")
        .eq("store_id", storeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: loyaltyConfig, refetch: refetchCfg } = useQuery({
    queryKey: ["crm-loyalty-cfg", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_loyalty_config")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const customers = useMemo(() => {
    const map = new Map<string, {
      phone: string;
      user_id: string | null;
      name: string;
      count: number;
      total: number;
      lastAt: Date;
      firstAt: Date;
      lastTotal: number;
    }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const phone = (o.customer_phone || "").trim();
      if (!phone) continue;
      const existing = map.get(phone);
      const at = new Date(o.created_at);
      if (existing) {
        existing.count += 1;
        existing.total += Number(o.total);
        if (at > existing.lastAt) {
          existing.lastAt = at;
          existing.lastTotal = Number(o.total);
        }
        if (at < existing.firstAt) existing.firstAt = at;
        if (!existing.user_id && o.user_id) existing.user_id = o.user_id;
      } else {
        map.set(phone, {
          phone,
          user_id: o.user_id ?? null,
          name: o.customer_name ?? phone,
          count: 1,
          total: Number(o.total),
          lastAt: at,
          firstAt: at,
          lastTotal: Number(o.total),
        });
      }
    }
    const blockedSet = new Set(blocked.map((b) => b.phone || b.user_id));
    return Array.from(map.values()).map((c) => ({
      ...c,
      segment: computeSegment(c.firstAt, c.lastAt, c.count, c.total),
      blocked: blockedSet.has(c.phone) || (c.user_id ? blockedSet.has(c.user_id) : false),
    }));
  }, [orders, blocked]);

  const filtered = useMemo(() => {
    return customers
      .filter((c) => {
        if (segFilter === "blocked") return c.blocked;
        if (segFilter !== "all" && c.segment !== segFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.total - a.total);
  }, [customers, segFilter, search]);

  const counts = useMemo(() => {
    const c = { all: customers.length, new: 0, recurring: 0, vip: 0, at_risk: 0, blocked: 0 };
    customers.forEach((cu) => {
      c[cu.segment]++;
      if (cu.blocked) c.blocked++;
    });
    return c;
  }, [customers]);

  const toggleBlock = async (cust: typeof filtered[number]) => {
    if (cust.blocked) {
      const { error } = await supabase
        .from("blocked_customers")
        .delete()
        .eq("store_id", storeId)
        .eq("phone", cust.phone);
      if (error) return toast.error(error.message);
      toast.success("Cliente desbloqueado");
    } else {
      const reason = prompt("Motivo do bloqueio (opcional):") ?? null;
      const { error } = await supabase.from("blocked_customers").insert({
        store_id: storeId,
        user_id: cust.user_id,
        phone: cust.phone,
        reason: reason || null,
      });
      if (error) return toast.error(error.message);
      toast.success("Cliente bloqueado");
    }
    qc.invalidateQueries({ queryKey: ["crm-blocked", storeId] });
  };

  const exportRanking = () => {
    const header = ["nome", "telefone", "pedidos", "gasto_total", "ultimo_pedido", "segmento"];
    const rows = customers
      .sort((a, b) => b.total - a.total)
      .map((c) => [
        c.name.replace(/[;\n]/g, " "),
        c.phone,
        c.count,
        c.total.toFixed(2),
        c.lastAt.toISOString().slice(0, 10),
        segmentCfg[c.segment].label,
      ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Segment chips */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SegChip
          icon={Users}
          label="Total"
          value={counts.all}
          active={segFilter === "all"}
          onClick={() => setSegFilter("all")}
          tone="muted"
        />
        {(["new", "recurring", "vip", "at_risk"] as const).map((s) => {
          const cfg = segmentCfg[s];
          return (
            <SegChip
              key={s}
              icon={cfg.icon}
              label={cfg.label}
              value={counts[s]}
              active={segFilter === s}
              onClick={() => setSegFilter(s)}
              tone={s}
            />
          );
        })}
      </div>

      {/* Loyalty config */}
      <LoyaltyConfigCard storeId={storeId} config={loyaltyConfig} onSaved={refetchCfg} />

      {/* List */}
      <section className="rounded-2xl border bg-card overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b p-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Clientes</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{filtered.length}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSegFilter(segFilter === "blocked" ? "all" : "blocked")}
              className={`flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-smooth ${
                segFilter === "blocked"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:border-destructive/40"
              }`}
            >
              <Ban className="h-3.5 w-3.5" />
              Bloqueados ({counts.blocked})
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Nome ou telefone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-52 rounded-xl border-2 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportRanking}>
              <Download className="mr-1 h-4 w-4" /> Ranking
            </Button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Cliente</th>
                <th className="px-4 py-2.5 text-right">Pedidos</th>
                <th className="px-4 py-2.5 text-right">Gasto total</th>
                <th className="px-4 py-2.5 text-left">Último pedido</th>
                <th className="px-4 py-2.5 text-left">Segmento</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const cfg = segmentCfg[c.segment];
                const Icon = cfg.icon;
                return (
                  <tr
                    key={c.phone}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setOpenProfile(c.phone)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold">
                            {c.name}
                            {c.blocked && <Ban className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{c.count}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{fmt(c.total)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm">{fmtDate(c.lastAt)}</div>
                      <div className="text-xs text-muted-foreground">{fmt(c.lastTotal)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cfg.cls}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleBlock(c)}
                        className={`rounded-lg border-2 px-2 py-1 text-[11px] font-bold transition-smooth ${
                          c.blocked
                            ? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            : "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        {c.blocked ? (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Desbloquear
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Ban className="h-3 w-3" /> Bloquear
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CustomerProfileDrawer
        storeId={storeId}
        phone={openProfile}
        onClose={() => setOpenProfile(null)}
      />
    </div>
  );
};

const SegChip = ({
  icon: Icon,
  label,
  value,
  active,
  onClick,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone: Segment | "muted";
}) => {
  const tones: Record<string, string> = {
    muted: "border-border bg-card",
    new: "border-blue-500/30 bg-blue-500/5",
    recurring: "border-primary/30 bg-primary/5",
    vip: "border-amber-500/30 bg-amber-500/5",
    at_risk: "border-destructive/30 bg-destructive/5",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-smooth ${tones[tone]} ${
        active ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
      }`}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-bold">{value}</div>
      </div>
    </button>
  );
};

const LoyaltyConfigCard = ({
  storeId,
  config,
  onSaved,
}: {
  storeId: string;
  config: any;
  onSaved: () => void;
}) => {
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [pointsPerReal, setPointsPerReal] = useState(String(config?.points_per_real ?? 1));
  const [redeemPoints, setRedeemPoints] = useState(String(config?.redeem_points ?? 100));
  const [redeemValue, setRedeemValue] = useState(String(config?.redeem_value ?? 5));
  const [validityDays, setValidityDays] = useState(String(config?.validity_days ?? ""));

  // Sync when config loads
  useMemo(() => {
    if (config) {
      setEnabled(config.enabled);
      setPointsPerReal(String(config.points_per_real));
      setRedeemPoints(String(config.redeem_points));
      setRedeemValue(String(config.redeem_value));
      setValidityDays(config.validity_days ? String(config.validity_days) : "");
    }
  }, [config]);

  const save = async () => {
    const payload = {
      store_id: storeId,
      enabled,
      points_per_real: Number(pointsPerReal) || 1,
      redeem_points: Number(redeemPoints) || 100,
      redeem_value: Number(redeemValue) || 5,
      validity_days: validityDays ? Number(validityDays) : null,
    };
    const { error } = await supabase
      .from("store_loyalty_config")
      .upsert(payload, { onConflict: "store_id" });
    if (error) return toast.error(error.message);
    toast.success("Programa de fidelidade salvo");
    onSaved();
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-500" />
        <h2 className="font-display text-lg font-bold">Programa de fidelidade</h2>
        <label className="ml-auto flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Ativo
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <FieldNum label="Pontos por R$ 1" value={pointsPerReal} onChange={setPointsPerReal} suffix="pts" />
        <FieldNum label="Resgate (pontos)" value={redeemPoints} onChange={setRedeemPoints} suffix="pts" />
        <FieldNum label="Valor do resgate" value={redeemValue} onChange={setRedeemValue} prefix="R$" />
        <FieldNum label="Validade (dias)" value={validityDays} onChange={setValidityDays} suffix="dias" placeholder="∞" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Cliente ganha <strong>{pointsPerReal || 0} pts</strong> por cada R$ 1. Resgata <strong>{redeemPoints || 0} pts</strong> por <strong>R$ {redeemValue || 0}</strong> de desconto.
          {validityDays && ` Pontos expiram em ${validityDays} dias.`}
        </p>
        <Button size="sm" onClick={save}>
          <Save className="mr-1 h-4 w-4" /> Salvar
        </Button>
      </div>
    </section>
  );
};

const FieldNum = ({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) => (
  <div>
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </label>
    <div className="flex items-center rounded-xl border-2 px-3 focus-within:border-primary">
      {prefix && <span className="mr-1 text-sm text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none"
      />
      {suffix && <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);
