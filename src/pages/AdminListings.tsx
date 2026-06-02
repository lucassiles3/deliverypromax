import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink, MapPin, Clock, Store as StoreIcon, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllExternalListings, type ExternalListing } from "@/hooks/useExternalListings";
import { CATEGORIES, SUBCATEGORIES } from "@/components/CategoryGrid";
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
  subcategory_key: string;
  catalog_url: string;
  address: string;
  lat: number | null;
  lng: number | null;
  opening_hours: Hours;
  active: boolean;
  delivery_time: string;
  delivery_radius_km: number | null;
  delivery_fee: number | null;
};

const emptyForm: FormState = {
  name: "",
  logo: "🏪",
  category_key: CATEGORIES[0].key,
  subcategory_key: "",
  catalog_url: "",
  address: "",
  lat: null,
  lng: null,
  opening_hours: defaultHours,
  active: true,
  delivery_time: "",
  delivery_radius_km: null,
  delivery_fee: null,
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
      subcategory_key: form.subcategory_key || null,
      catalog_url: form.catalog_url.trim(),
      address: form.address.trim() || null,
      lat: form.lat,
      lng: form.lng,
      opening_hours: form.opening_hours,
      active: form.active,
      delivery_time: form.delivery_time.trim() || null,
      delivery_radius_km: form.delivery_radius_km,
      delivery_fee: form.delivery_fee,
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
      subcategory_key: (l as any).subcategory_key ?? "",
      catalog_url: l.catalog_url,
      address: l.address ?? "",
      lat: l.lat,
      lng: l.lng,
      opening_hours: { ...defaultHours, ...((l.opening_hours as Hours) ?? {}) },
      active: l.active,
      delivery_time: (l as any).delivery_time ?? "",
      delivery_radius_km: (l as any).delivery_radius_km ?? null,
      delivery_fee: (l as any).delivery_fee ?? null,
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
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-2xl">
                      {l.logo && /^https?:\/\//i.test(l.logo) ? (
                        <img src={l.logo} alt={l.name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{l.logo || "🏪"}</span>
                      )}
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
                      <p className="text-xs text-muted-foreground">
                        {cat?.label ?? l.category_key}
                        {(l as any).subcategory_key && (() => {
                          const sub = SUBCATEGORIES[l.category_key]?.find(
                            (s) => s.key === (l as any).subcategory_key,
                          );
                          return sub ? ` • ${sub.emoji} ${sub.label}` : null;
                        })()}
                      </p>
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
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("listing-logos").getPublicUrl(path);
    set("logo", data.publicUrl);
    toast.success("Logo enviada");
  };

  const isImageUrl = (s: string) => /^https?:\/\//i.test(s);

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

        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          <div>
            <Label className="text-xs">Logo</Label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleLogoUpload(file);
              }}
              className={`mt-1 flex h-36 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted text-center text-4xl transition-colors ${
                dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
              {isImageUrl(value.logo) ? (
                <img src={value.logo} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span>{value.logo || "🏪"}</span>
                  <span className="mt-1 px-2 text-[10px] font-semibold text-muted-foreground">
                    {uploading ? "Enviando..." : "Arraste ou clique"}
                  </span>
                </>
              )}
            </label>
            <Input
              className="mt-1.5 text-xs"
              value={value.logo}
              onChange={(e) => set("logo", e.target.value)}
              placeholder="🏪 ou URL"
            />
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
                  onChange={(e) =>
                    onChange({ ...value, category_key: e.target.value, subcategory_key: "" })
                  }
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
            {/* Subcategoria com chips para seleção rápida */}
            {(SUBCATEGORIES[value.category_key]?.length ?? 0) > 0 && (
              <div>
                <Label className="text-xs">Subcategoria</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {SUBCATEGORIES[value.category_key].map((s) => {
                    const on = value.subcategory_key === s.key;
                    return (
                      <button
                        type="button"
                        key={s.key}
                        onClick={() => set("subcategory_key", on ? "" : s.key)}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-smooth ${
                          on
                            ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <span>{s.emoji}</span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Tempo de entrega</Label>
                <select
                  value={value.delivery_time}
                  onChange={(e) => set("delivery_time", e.target.value)}
                  className="mt-1 w-full rounded-md border-2 border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {Array.from({ length: 12 }, (_, i) => (i + 1) * 10).map((m) => (
                    <option key={m} value={`${m} min`}>{`Até ${m} min`}</option>
                  ))}
                  {Array.from({ length: 6 }, (_, i) => (i + 1) * 10).map((m) => {
                    const v = `${m}-${m + 10} min`;
                    return <option key={v} value={v}>{v}</option>;
                  })}
                </select>
              </div>
              <div>
                <Label className="text-xs">Raio de entrega (km)</Label>
                <select
                  value={value.delivery_radius_km ?? ""}
                  onChange={(e) =>
                    set("delivery_radius_km", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border-2 border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {[1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50].map((km) => (
                    <option key={km} value={km}>{km} km</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Frete a partir de (R$) — opcional</Label>
                <div className="relative mt-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    a partir de
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={value.delivery_fee ?? ""}
                    onChange={(e) =>
                      set("delivery_fee", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="0,00"
                    className="pl-24"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>


        <div>
          <Label className="text-xs mb-1 inline-block">Localização no mapa</Label>
          <LocationPicker
            value={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : null}
            onChange={(c) => onChange({ ...value, lat: c.lat, lng: c.lng })}
            address={value.address}
            onAddressChange={(addr) => onChange({ ...value, address: addr })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pesquise um endereço, CEP ou bairro — o mapa atualiza. Arraste o pino e o endereço é
            preenchido automaticamente.
          </p>
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
