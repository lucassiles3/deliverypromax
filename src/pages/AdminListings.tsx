import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink, MapPin, Clock, Store as StoreIcon, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllExternalListings, type ExternalListing } from "@/hooks/useExternalListings";
import { CATEGORIES } from "@/components/CategoryGrid";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const AUTHORIZED_EMAIL = "suporteitchat@gmail.com";

type Hours = Record<string, { open: string; close: string; closed: boolean }>;
const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];
const defaultHours: Hours = DAYS.reduce((acc, d) => {
  acc[d.key] = { open: "09:00", close: "18:00", closed: false };
  return acc;
}, {} as Hours);

type FormState = {
  id?: string;
  name: string;
  logo: string;
  category_key: string;
  catalog_url: string;
  address: string;
  lat: number | null;
  lng: number | null;
  opening_hours: Hours;
  active: boolean;
  delivery_time: string;
  delivery_radius_km: number | null;
};

const emptyForm: FormState = {
  name: "",
  logo: "🏪",
  category_key: CATEGORIES[0].key,
  catalog_url: "",
  address: "",
  lat: null,
  lng: null,
  opening_hours: defaultHours,
  active: true,
  delivery_time: "",
  delivery_radius_km: null,
};

const AdminListings = () => {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useAllExternalListings();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);

  useEffect(() => {
    document.title = "Estabelecimentos parceiros • Painel";
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return listings;
    const q = search.toLowerCase();
    return listings.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q),
    );
  }, [listings, search]);

  if (authLoading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;
  if ((user.email ?? "").toLowerCase() !== AUTHORIZED_EMAIL) {
    return (
      <div className="container py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva para a conta autorizada.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">← Voltar</Link>
      </div>
    );
  }

  const save = async (form: FormState) => {
    if (!form.name.trim() || !form.catalog_url.trim()) {
      toast.error("Nome e link do catálogo são obrigatórios");
      return;
    }
    const payload = {
      name: form.name.trim(),
      logo: form.logo.trim() || null,
      category_key: form.category_key,
      catalog_url: form.catalog_url.trim(),
      address: form.address.trim() || null,
      lat: form.lat,
      lng: form.lng,
      opening_hours: form.opening_hours,
      active: form.active,
      delivery_time: form.delivery_time.trim() || null,
      delivery_radius_km: form.delivery_radius_km,
      created_by: user.id,
    };
    const op = form.id
      ? supabase.from("external_listings" as any).update(payload).eq("id", form.id)
      : supabase.from("external_listings" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Estabelecimento atualizado" : "Estabelecimento cadastrado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["external-listings-all"] });
    qc.invalidateQueries({ queryKey: ["external-listings"] });
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    const { error } = await supabase.from("external_listings" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["external-listings-all"] });
    qc.invalidateQueries({ queryKey: ["external-listings"] });
  };

  const toggleActive = async (l: ExternalListing) => {
    const { error } = await supabase
      .from("external_listings" as any)
      .update({ active: !l.active })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["external-listings-all"] });
    qc.invalidateQueries({ queryKey: ["external-listings"] });
  };

  const startEdit = (l: ExternalListing) => {
    setEditing({
      id: l.id,
      name: l.name,
      logo: l.logo ?? "🏪",
      category_key: l.category_key,
      catalog_url: l.catalog_url,
      address: l.address ?? "",
      lat: l.lat,
      lng: l.lng,
      opening_hours: { ...defaultHours, ...((l.opening_hours as Hours) ?? {}) },
      active: l.active,
      delivery_time: (l as any).delivery_time ?? "",
      delivery_radius_km: (l as any).delivery_radius_km ?? null,
    });
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-16">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="container flex h-14 items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> App
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-lg font-bold">Estabelecimentos parceiros</h1>
          <Button className="ml-auto" onClick={() => setEditing({ ...emptyForm })}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo
          </Button>
        </div>
      </header>

      <main className="container py-6">
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card p-2 shadow-soft max-w-md">
          <Search className="ml-2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="flex-1 bg-transparent py-1 text-sm outline-none"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
            <StoreIcon className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
            <p className="font-bold">Nenhum estabelecimento cadastrado</p>
            <Button className="mt-4" onClick={() => setEditing({ ...emptyForm })}>
              <Plus className="mr-1.5 h-4 w-4" /> Cadastrar primeiro
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => {
              const cat = CATEGORIES.find((c) => c.key === l.category_key);
              return (
                <article
                  key={l.id}
                  className="rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:shadow-float"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                      {l.logo || "🏪"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-bold">{l.name}</h3>
                        {!l.active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{cat?.label ?? l.category_key}</p>
                      {l.address && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {l.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={l.catalog_url}
                    rel="noopener"
                    className="mt-3 flex items-center gap-1 truncate text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> {l.catalog_url}
                  </a>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <Switch checked={l.active} onCheckedChange={() => toggleActive(l)} />
                      Ativo
                    </label>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(l.id, l.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <ListingForm
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      )}
    </div>
  );
};

const ListingForm = ({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...value, [k]: v });

  const applyToAllDays = () => {
    const ref = value.opening_hours.mon;
    const next: Hours = { ...value.opening_hours };
    DAYS.forEach((d) => (next[d.key] = { ...ref }));
    set("opening_hours", next);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar estabelecimento" : "Novo estabelecimento"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[100px_1fr]">
          <div>
            <Label className="text-xs">Logo (emoji ou URL)</Label>
            <Input value={value.logo} onChange={(e) => set("logo", e.target.value)} placeholder="🏪" />
            <div className="mt-2 flex h-20 items-center justify-center rounded-xl bg-muted text-4xl">
              {value.logo || "🏪"}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={value.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Categoria *</Label>
                <select
                  value={value.category_key}
                  onChange={(e) => set("category_key", e.target.value)}
                  className="mt-1 w-full rounded-md border-2 border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Link do catálogo *</Label>
                <Input
                  value={value.catalog_url}
                  onChange={(e) => set("catalog_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={value.address} onChange={(e) => set("address", e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 inline-block">Localização no mapa</Label>
          <LocationPicker
            value={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : null}
            onChange={(c) => onChange({ ...value, lat: c.lat, lng: c.lng })}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Horário de funcionamento
            </Label>
            <button
              type="button"
              onClick={applyToAllDays}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Aplicar seg → todos
            </button>
          </div>
          <div className="space-y-1.5">
            {DAYS.map((d) => {
              const h = value.opening_hours[d.key] ?? { open: "09:00", close: "18:00", closed: false };
              return (
                <div key={d.key} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                  <span className="w-10 text-xs font-bold uppercase">{d.label}</span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={!h.closed}
                      onCheckedChange={(open) =>
                        set("opening_hours", {
                          ...value.opening_hours,
                          [d.key]: { ...h, closed: !open },
                        })
                      }
                    />
                    {h.closed ? "Fechado" : "Aberto"}
                  </label>
                  {!h.closed && (
                    <div className="ml-auto flex items-center gap-1">
                      <input
                        type="time"
                        value={h.open}
                        onChange={(e) =>
                          set("opening_hours", {
                            ...value.opening_hours,
                            [d.key]: { ...h, open: e.target.value },
                          })
                        }
                        className="rounded border px-2 py-1 text-xs"
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={(e) =>
                          set("opening_hours", {
                            ...value.opening_hours,
                            [d.key]: { ...h, close: e.target.value },
                          })
                        }
                        className="rounded border px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={value.active} onCheckedChange={(v) => set("active", v)} />
          <Label className="text-sm">Ativo (aparece para clientes)</Label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminListings;
