import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  History,
  PackageSearch,
  Plus,
  ScanLine,
  Search,
  TrendingDown,
} from "lucide-react";
import { brl } from "@/lib/format";

// ---------- Tipos ----------
type Product = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  unit: string | null;
  price: number;
  cost_price: number | null;
  stock: number | null;
  min_stock: number | null;
  location: string | null;
  supplier_id: string | null;
  track_stock: boolean;
  active: boolean;
};

type MovementType =
  | "sale"
  | "return"
  | "purchase"
  | "adjustment"
  | "loss"
  | "transfer_in"
  | "transfer_out";

type Movement = {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  reason: string | null;
  created_at: string;
  products?: { name: string } | null;
};

const movementLabel: Record<MovementType, { label: string; color: string }> = {
  sale: { label: "Venda", color: "bg-blue-500/10 text-blue-700" },
  return: { label: "Devolução", color: "bg-green-500/10 text-green-700" },
  purchase: { label: "Compra", color: "bg-emerald-500/10 text-emerald-700" },
  adjustment: { label: "Ajuste", color: "bg-amber-500/10 text-amber-700" },
  loss: { label: "Perda", color: "bg-destructive/10 text-destructive" },
  transfer_in: { label: "Transf. entrada", color: "bg-indigo-500/10 text-indigo-700" },
  transfer_out: { label: "Transf. saída", color: "bg-purple-500/10 text-purple-700" },
};

// ---------- Hook principal ----------
const useStockProducts = (storeId: string) =>
  useQuery({
    queryKey: ["stock-products", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, category, sku, barcode, brand, unit, price, cost_price, stock, min_stock, location, supplier_id, track_stock, active",
        )
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

const useMovements = (storeId: string) =>
  useQuery({
    queryKey: ["stock-movements", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, product_id, type, quantity, unit_cost, reason, created_at, products(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

const registerMovement = async (args: {
  storeId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  unitCost?: number;
}) => {
  const { error } = await supabase.rpc("register_stock_movement", {
    _store_id: args.storeId,
    _product_id: args.productId,
    _type: args.type,
    _quantity: args.quantity,
    _reason: args.reason ?? null,
    _order_id: null,
    _unit_cost: args.unitCost ?? null,
  });
  if (error) throw error;
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function StockTab({ storeId }: { storeId: string }) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="products">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="products"><Boxes className="mr-1.5 h-4 w-4" />Produtos</TabsTrigger>
          <TabsTrigger value="quick"><Plus className="mr-1.5 h-4 w-4" />Entrada rápida</TabsTrigger>
          <TabsTrigger value="inventory"><ScanLine className="mr-1.5 h-4 w-4" />Inventário</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="mr-1.5 h-4 w-4" />Alertas</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="products"><ProductsPanel storeId={storeId} /></TabsContent>
        <TabsContent value="quick"><QuickEntryPanel storeId={storeId} /></TabsContent>
        <TabsContent value="inventory"><InventoryPanel storeId={storeId} /></TabsContent>
        <TabsContent value="alerts"><AlertsPanel storeId={storeId} /></TabsContent>
        <TabsContent value="history"><HistoryPanel storeId={storeId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// PANELS
// ============================================================
function ProductsPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useStockProducts(storeId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "zero" | "ok">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const stock = Number(p.stock ?? 0);
      const min = Number(p.min_stock ?? 0);
      if (filter === "zero" && stock > 0) return false;
      if (filter === "low" && !(p.track_stock && stock > 0 && stock <= min && min > 0)) return false;
      if (filter === "ok" && (stock <= 0 || (min > 0 && stock <= min))) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, filter]);

  const stats = useMemo(() => {
    const tracked = products.filter((p) => p.track_stock);
    const zero = tracked.filter((p) => Number(p.stock ?? 0) <= 0).length;
    const low = tracked.filter(
      (p) =>
        Number(p.min_stock ?? 0) > 0 &&
        Number(p.stock ?? 0) > 0 &&
        Number(p.stock ?? 0) <= Number(p.min_stock ?? 0),
    ).length;
    const value = products.reduce(
      (s, p) => s + Number(p.cost_price ?? 0) * Number(p.stock ?? 0),
      0,
    );
    return { total: products.length, zero, low, value };
  }, [products]);

  const updateInline = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Product> }) => {
      const { error } = await supabase.from("products").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-products", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Produtos" value={String(stats.total)} icon={Boxes} />
        <StatCard label="Sem estoque" value={String(stats.zero)} icon={TrendingDown} tone="danger" />
        <StatCard label="Estoque baixo" value={String(stats.low)} icon={AlertTriangle} tone="warning" />
        <StatCard label="Valor em estoque" value={brl(stats.value)} icon={PackageSearch} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Produtos</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 md:w-72"
                  placeholder="Buscar por nome, SKU, código de barras…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Estoque baixo</SelectItem>
                  <SelectItem value="zero">Zerados</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU / Cód. barras</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produto.</TableCell></TableRow>
                )}
                {filtered.map((p) => {
                  const stock = Number(p.stock ?? 0);
                  const min = Number(p.min_stock ?? 0);
                  const status =
                    !p.track_stock ? { label: "Sem controle", className: "bg-muted text-muted-foreground" } :
                    stock <= 0 ? { label: "Zerado", className: "bg-destructive/10 text-destructive" } :
                    min > 0 && stock <= min ? { label: "Baixo", className: "bg-amber-500/10 text-amber-700" } :
                    { label: "OK", className: "bg-green-500/10 text-green-700" };

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[240px]">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.category ?? "—"}{p.brand ? ` • ${p.brand}` : ""}{p.location ? ` • 📍${p.location}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-mono">{p.sku || "—"}</div>
                        <div className="text-muted-foreground font-mono">{p.barcode || ""}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {p.cost_price != null ? brl(Number(p.cost_price)) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{brl(Number(p.price))}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 text-right"
                          defaultValue={p.min_stock ?? 0}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(p.min_stock ?? 0)) {
                              updateInline.mutate({ id: p.id, patch: { min_stock: v } as any });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="h-8 w-24 text-right font-bold"
                          defaultValue={stock}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== stock) {
                              const delta = v - stock;
                              registerMovement({
                                storeId,
                                productId: p.id,
                                type: "adjustment",
                                quantity: delta,
                                reason: "Ajuste manual via tabela",
                              })
                                .then(() => {
                                  toast.success("Estoque ajustado");
                                  qc.invalidateQueries({ queryKey: ["stock-products", storeId] });
                                  qc.invalidateQueries({ queryKey: ["stock-movements", storeId] });
                                })
                                .catch((err) => toast.error(err.message));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----- Entrada rápida (compra / ajuste / perda) -----
function QuickEntryPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: products = [] } = useStockProducts(storeId);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<MovementType>("purchase");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    ).slice(0, 10);
  }, [products, search]);

  const selected = products.find((p) => p.id === productId);

  const submit = async () => {
    if (!productId) return toast.error("Selecione um produto");
    const n = Number(qty);
    if (!n || n <= 0) return toast.error("Quantidade inválida");
    const signed = type === "loss" || type === "transfer_out" ? -Math.abs(n) : Math.abs(n);
    try {
      await registerMovement({
        storeId,
        productId,
        type,
        quantity: signed,
        reason: reason || undefined,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast.success("Movimentação registrada");
      setQty(""); setUnitCost(""); setReason("");
      qc.invalidateQueries({ queryKey: ["stock-products", storeId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", storeId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Nova movimentação</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Produto</Label>
          <Input
            placeholder="Buscar por nome, SKU ou código de barras…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProductId(p.id); setSearch(p.name); }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                  productId === p.id ? "bg-primary/10" : ""
                }`}
              >
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku || p.barcode || ""}</span>
                </span>
                <span className="text-xs text-muted-foreground">Atual: {Number(p.stock ?? 0)}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Compra (entrada)</SelectItem>
                <SelectItem value="return">Devolução (entrada)</SelectItem>
                <SelectItem value="adjustment">Ajuste (±)</SelectItem>
                <SelectItem value="loss">Perda / quebra (saída)</SelectItem>
                <SelectItem value="transfer_in">Transferência entrada</SelectItem>
                <SelectItem value="transfer_out">Transferência saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Custo unitário (opcional)</Label>
            <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" />
          </div>
        </div>

        <div>
          <Label>Observação</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Nota fiscal 1234 / quebra na prateleira" />
        </div>

        {selected && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            Selecionado: <strong>{selected.name}</strong> • Estoque atual: <strong>{Number(selected.stock ?? 0)}</strong>
          </div>
        )}

        <Button onClick={submit} className="w-full md:w-auto">
          {type === "purchase" || type === "return" || type === "transfer_in" ? (
            <ArrowDownToLine className="mr-1.5 h-4 w-4" />
          ) : (
            <ArrowUpFromLine className="mr-1.5 h-4 w-4" />
          )}
          Registrar
        </Button>
      </CardContent>
    </Card>
  );
}

// ----- Inventário: bipa código + ajusta -----
function InventoryPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: products = [] } = useStockProducts(storeId);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Product | null>(null);
  const [counted, setCounted] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const handleScan = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    const p = products.find(
      (x) =>
        (x.barcode ?? "").toLowerCase() === q ||
        (x.sku ?? "").toLowerCase() === q,
    );
    if (!p) {
      toast.error("Produto não encontrado");
      setCode("");
      return;
    }
    setFound(p);
    setCounted(String(p.stock ?? 0));
    setCode("");
  };

  const confirm = async () => {
    if (!found) return;
    const v = Number(counted);
    if (Number.isNaN(v)) return toast.error("Quantidade inválida");
    const delta = v - Number(found.stock ?? 0);
    if (delta === 0) {
      toast.info("Sem divergência");
      setFound(null);
      codeRef.current?.focus();
      return;
    }
    try {
      await registerMovement({
        storeId,
        productId: found.id,
        type: "adjustment",
        quantity: delta,
        reason: `Inventário: contado ${v}, sistema ${found.stock ?? 0}`,
      });
      toast.success(`Ajuste ${delta > 0 ? "+" : ""}${delta} aplicado`);
      setFound(null); setCounted("");
      qc.invalidateQueries({ queryKey: ["stock-products", storeId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", storeId] });
      codeRef.current?.focus();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="h-4 w-4" /> Inventário rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Bipe o código de barras ou digite o SKU</Label>
          <Input
            ref={codeRef}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleScan(code);
            }}
            placeholder="Aguardando leitura…"
            className="font-mono text-lg"
          />
        </div>

        {found && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div>
              <div className="font-bold text-lg">{found.name}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {found.sku || "—"} {found.barcode ? `• ${found.barcode}` : ""}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sistema</Label>
                <Input value={Number(found.stock ?? 0)} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Contado</Label>
                <Input
                  type="number"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} className="flex-1">Confirmar ajuste</Button>
              <Button variant="outline" onClick={() => { setFound(null); codeRef.current?.focus(); }}>Cancelar</Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Dica: leitores USB/Bluetooth funcionam direto — apontou e leu, o sistema localiza o produto.
        </p>
      </CardContent>
    </Card>
  );
}

// ----- Alertas -----
function AlertsPanel({ storeId }: { storeId: string }) {
  const { data: products = [] } = useStockProducts(storeId);

  const zeroed = products.filter((p) => p.track_stock && Number(p.stock ?? 0) <= 0);
  const low = products.filter(
    (p) =>
      p.track_stock &&
      Number(p.min_stock ?? 0) > 0 &&
      Number(p.stock ?? 0) > 0 &&
      Number(p.stock ?? 0) <= Number(p.min_stock ?? 0),
  );
  const noMin = products.filter((p) => p.track_stock && !Number(p.min_stock ?? 0));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AlertList
        title="Sem estoque"
        items={zeroed}
        tone="danger"
        empty="Nenhum produto zerado 🎉"
      />
      <AlertList
        title="Estoque baixo"
        items={low}
        tone="warning"
        empty="Tudo acima do mínimo."
      />
      <AlertList
        title="Sem mínimo definido"
        items={noMin}
        tone="info"
        empty="Todos os produtos têm mínimo configurado."
      />
    </div>
  );
}

function AlertList({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: Product[];
  tone: "danger" | "warning" | "info";
  empty: string;
}) {
  const colors = {
    danger: "border-destructive/30",
    warning: "border-amber-500/30",
    info: "border-blue-500/30",
  }[tone];
  return (
    <Card className={`border-2 ${colors}`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title} ({items.length})</CardTitle></CardHeader>
      <CardContent className="max-h-96 overflow-y-auto space-y-1.5">
        {items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p>}
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
            <span className="truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              {Number(p.stock ?? 0)}{p.min_stock ? ` / ${p.min_stock}` : ""}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ----- Histórico -----
function HistoryPanel({ storeId }: { storeId: string }) {
  const { data: movements = [], isLoading } = useMovements(storeId);
  const [type, setType] = useState<"all" | MovementType>("all");

  const filtered = useMemo(
    () => (type === "all" ? movements : movements.filter((m) => m.type === type)),
    [movements, type],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Histórico de movimentações</CardTitle>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(movementLabel).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma movimentação.</TableCell></TableRow>
              )}
              {filtered.map((m) => {
                const cfg = movementLabel[m.type];
                const positive = Number(m.quantity) >= 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{m.products?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${positive ? "text-green-600" : "text-destructive"}`}>
                      {positive ? "+" : ""}{Number(m.quantity)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {m.unit_cost != null ? brl(Number(m.unit_cost)) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                      {m.reason ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- helpers -----
function StatCard({
  label, value, icon: Icon, tone,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: "danger" | "warning" }) {
  const color =
    tone === "danger" ? "text-destructive" :
    tone === "warning" ? "text-amber-600" :
    "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${color}`}>
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
