import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { optimizeImage } from "@/lib/imageOptimization";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { CATEGORIES, SUBCATEGORIES } from "@/components/CategoryGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Store,
  ExternalLink,
  MapPin,
  Clock,
  Pencil,
  Loader2,
  ArrowLeft,
  Truck,
  Sparkles,
  Globe,
  CheckCircle2,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";

export type ExternalListingData = {
  id: string;
  name: string;
  logo: string | null;
  category_key: string;
  subcategory_key: string | null;
  catalog_url: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  active: boolean;
  delivery_time: string | null;
  delivery_radius_km: number | null;
  delivery_fee: number | null;
  created_at?: string;
  created_by?: string;
};

type Hours = Record<string, { open: string; close: string; closed: boolean }>;
const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Segunda-feira" },
  { key: "tue", label: "Terça-feira" },
  { key: "wed", label: "Quarta-feira" },
  { key: "thu", label: "Quinta-feira" },
  { key: "fri", label: "Sexta-feira" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const defaultHours: Hours = DAYS.reduce((acc, d) => {
  acc[d.key] = { open: "09:00", close: "18:00", closed: false };
  return acc;
}, {} as Hours);

export const ExternalCatalogAdmin = ({
  listing,
  onRefresh,
  onCreateFullStore,
}: {
  listing: ExternalListingData;
  onRefresh: () => void;
  onCreateFullStore?: () => void;
}) => {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(listing.name);
  const [logo, setLogo] = useState(listing.logo || "🏪");
  const [categoryKey, setCategoryKey] = useState(listing.category_key || CATEGORIES[0].key);
  const [subKey, setSubKey] = useState(listing.subcategory_key || "");
  const [catalogUrl, setCatalogUrl] = useState(listing.catalog_url || "");
  const [address, setAddress] = useState(listing.address || "");
  const [location, setLocation] = useState<PickedLocation | null>(
    listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng, address: listing.address || "" } : null
  );
  const [hours, setHours] = useState<Hours>(
    listing.opening_hours ? (listing.opening_hours as Hours) : defaultHours
  );
  const [deliveryTime, setDeliveryTime] = useState(listing.delivery_time || "");
  const [deliveryRadius, setDeliveryRadius] = useState<number | "">(listing.delivery_radius_km ?? 10);
  const [deliveryFee, setDeliveryFee] = useState<number | "">(listing.delivery_fee ?? "");
  const [active, setActive] = useState(listing.active);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const subOptions = SUBCATEGORIES[categoryKey] ?? [];

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem válida");
    setUploading(true);
    try {
      const opt = await optimizeImage(file, { preset: "logo" });
      const optimizedFile = opt.file;
      const ext = optimizedFile.name.split(".").pop() || "webp";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-logos").upload(path, optimizedFile, {
        cacheControl: "31536000",
        upsert: false,
        contentType: optimizedFile.type,
      });
      setUploading(false);
      if (error) return toast.error(error.message);
      const { data } = supabase.storage.from("listing-logos").getPublicUrl(path);
      setLogo(data.publicUrl);
      if (opt.compressionRatio > 0.05) {
        toast.success(`Logo otimizada (-${(opt.compressionRatio * 100).toFixed(0)}%) e enviada`);
      } else {
        toast.success("Logo enviada");
      }
    } catch (err: any) {
      setUploading(false);
      toast.error(err.message ?? "Erro no upload");
    }
  };

  const handleToggleActive = async (newVal: boolean) => {
    setActive(newVal);
    const { error } = await supabase
      .from("external_listings" as any)
      .update({ active: newVal })
      .eq("id", listing.id);
    if (error) {
      setActive(!newVal);
      return toast.error(error.message);
    }
    if (listing.created_by) {
      await supabase
        .from("stores")
        .update({ open: newVal })
        .eq("owner_id", listing.created_by);
    }
    toast.success(newVal ? "Catálogo ativado no itChat" : "Catálogo pausado");
    qc.invalidateQueries({ queryKey: ["external-listings"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["store-access"] });
    onRefresh();
  };

  const saveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) return toast.error("Informe o nome do estabelecimento");
    if (!catalogUrl.trim()) return toast.error("Informe a URL do catálogo");

    setSaving(true);
    const payload = {
      name: name.trim(),
      logo: logo.trim() || null,
      category_key: categoryKey,
      subcategory_key: subKey || null,
      catalog_url: catalogUrl.trim(),
      address: address.trim() || null,
      lat: location?.lat ?? listing.lat ?? null,
      lng: location?.lng ?? listing.lng ?? null,
      opening_hours: hours,
      active,
      delivery_time: deliveryTime.trim() || null,
      delivery_radius_km: deliveryRadius === "" ? null : Number(deliveryRadius),
      delivery_fee: deliveryFee === "" ? null : Number(deliveryFee),
    };

    const { error } = await supabase
      .from("external_listings" as any)
      .update(payload)
      .eq("id", listing.id);

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    if (listing.created_by) {
      const selectedCategory = CATEGORIES.find((c) => c.key === categoryKey);
      const selectedSub = subOptions.find((s) => s.key === subKey);
      const cuisine = selectedSub?.label || selectedCategory?.label || "";

      await supabase
        .from("stores")
        .update({
          name: name.trim(),
          logo: logo.trim() || null,
          city: address.trim() || null,
          lat: location?.lat ?? listing.lat ?? null,
          lng: location?.lng ?? listing.lng ?? null,
          cuisine: cuisine.trim() || null,
          opening_hours: hours,
          delivery_time: deliveryTime.trim() || null,
          delivery_fee: deliveryFee === "" ? null : Number(deliveryFee),
          open: active,
        })
        .eq("owner_id", listing.created_by);
    }

    setSaving(false);
    toast.success("Catálogo atualizado com sucesso! 🎉");
    setIsEditing(false);
    qc.invalidateQueries({ queryKey: ["external-listings"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["store-access"] });
    onRefresh();
  };

  const isImageUrl = (s: string) => /^https?:\/\//i.test(s);
  const currentCategoryLabel = CATEGORIES.find((c) => c.key === listing.category_key)?.label || listing.category_key;

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> App
            </Link>
            <div className="h-4 w-[1px] bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-accent text-accent-foreground">
                {isImageUrl(listing.logo || "") ? (
                  <img src={listing.logo!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">{listing.logo || "🏪"}</span>
                )}
              </div>
              <div>
                <h1 className="font-display text-sm font-bold leading-tight">{listing.name}</h1>
                <p className="text-[10px] text-muted-foreground">Painel de Catálogo Digital</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={listing.catalog_url}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold transition-smooth hover:border-primary"
            >
              <Globe className="h-3.5 w-3.5 text-primary" />
              Abrir meu Catálogo
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
              <span className="text-xs font-bold">Visível no itChat</span>
              <Switch checked={active} onCheckedChange={handleToggleActive} />
            </div>
          </div>
        </div>
      </header>

      <div className="container py-6 space-y-6">
        {/* Banner do Catálogo Ativo */}
        <div className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Catálogo Digital Conectado
              </div>
              <h2 className="font-display text-2xl font-bold">{listing.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>{currentCategoryLabel}</span>
                <span>•</span>
                <a
                  href={listing.catalog_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-bold text-primary underline inline-flex items-center gap-1"
                >
                  {listing.catalog_url} <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="gap-2">
                <Pencil className="h-4 w-4" /> {isEditing ? "Cancelar edição" : "Editar informações"}
              </Button>
              <a
                href={listing.catalog_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow transition-bounce hover:scale-105"
              >
                <Globe className="h-4 w-4" /> Testar link do catálogo
              </a>
            </div>
          </div>
        </div>

        {/* Upgrade / Criar Loja Completa Banner */}
        <div className="rounded-3xl border-2 border-accent/40 bg-card p-6 shadow-float">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Evolua seu atendimento</span>
              </div>
              <h3 className="font-display text-lg font-bold">Quer receber pedidos ao vivo e gerenciar entregas direto pelo itChat?</h3>
              <p className="text-xs text-muted-foreground">
                Além de divulgar o link do seu catálogo, você pode criar uma loja completa com PDV, controle de mesa, gestão de entregadores e relatórios financeiros.
              </p>
            </div>
            {onCreateFullStore && (
              <Button onClick={onCreateFullStore} className="shrink-0 gap-2 gradient-primary">
                <Rocket className="h-4 w-4" /> Criar Loja Completa no itChat
              </Button>
            )}
          </div>
        </div>

        {/* Informações Atuais / Modo Edição */}
        {!isEditing ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Detalhes do Estabelecimento */}
            <div className="rounded-3xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" /> Informações da Loja
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Link do Catálogo:</span>
                  <a href={listing.catalog_url} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary font-bold break-all hover:underline">
                    {listing.catalog_url}
                  </a>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Categoria:</span>
                  <span className="font-bold">{currentCategoryLabel}</span>
                </div>

                {listing.address && (
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Endereço:</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {listing.address}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Tempo de Entrega</span>
                    <span className="font-bold text-sm">{listing.delivery_time || "Não informado"}</span>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Taxa Estimada</span>
                    <span className="font-bold text-sm">
                      {listing.delivery_fee != null ? `R$ ${listing.delivery_fee.toFixed(2).replace(".", ",")}` : "Grátis / Sob consulta"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Horários de Funcionamento */}
            <div className="rounded-3xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Horários de Atendimento
                </h3>
              </div>

              <div className="divide-y text-xs">
                {DAYS.map((d) => {
                  const h = (listing.opening_hours as Hours)?.[d.key];
                  return (
                    <div key={d.key} className="flex items-center justify-between py-2">
                      <span className="font-bold">{d.label}</span>
                      {h?.closed ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground font-bold">Fechado</span>
                      ) : (
                        <span className="font-medium text-foreground">
                          {h?.open || "09:00"} às {h?.close || "18:00"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Formulário de Edição Completo */
          <form onSubmit={saveChanges} className="rounded-3xl border bg-card p-6 shadow-float space-y-6">
            <div className="border-b pb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Editar meu Catálogo Digital</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex gap-3 md:col-span-2">
                <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted text-3xl hover:border-primary">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  />
                  {isImageUrl(logo) ? (
                    <img src={logo} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span>{logo || "🏪"}</span>
                  )}
                  {uploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-[10px] font-bold">
                      Enviando...
                    </span>
                  )}
                </label>
                <div className="flex-1">
                  <Label>Nome do Estabelecimento *</Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pizzaria do João"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Clique na imagem ao lado para alterar a logo da loja</p>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label>Link / URL do seu Catálogo Digital *</Label>
                <Input
                  required
                  value={catalogUrl}
                  onChange={(e) => setCatalogUrl(e.target.value)}
                  placeholder="https://sualoja.anota.ai ou https://cardapioweb.com/..."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Quando os clientes clicarem no seu estabelecimento no itChat, eles serão direcionados diretamente para este link.
                </p>
              </div>

              <div>
                <Label>Categoria Principal *</Label>
                <select
                  value={categoryKey}
                  onChange={(e) => {
                    setCategoryKey(e.target.value);
                    setSubKey("");
                  }}
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {subOptions.length > 0 && (
                <div>
                  <Label>Especialidade / Subcategoria</Label>
                  <select
                    value={subKey}
                    onChange={(e) => setSubKey(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                  >
                    <option value="">— Selecionar —</option>
                    {subOptions.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2 space-y-2">
                <Label>Endereço e Localização para Busca no Mapa</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                />
                <LocationPicker
                  value={location}
                  onChange={(loc) => {
                    setLocation(loc);
                    if (loc.address && !address) setAddress(loc.address);
                  }}
                />
              </div>

              <div>
                <Label>Tempo estimado de entrega</Label>
                <Input
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="Ex: 30-45 min"
                />
              </div>

              <div>
                <Label>Taxa estimada de entrega (R$)</Label>
                <Input
                  type="number"
                  step="0.50"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 5.00"
                />
              </div>
            </div>

            {/* Grade de Horários */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-display text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Horários de Funcionamento
              </h4>

              <div className="grid gap-2 sm:grid-cols-2">
                {DAYS.map((d) => {
                  const h = hours[d.key] || { open: "09:00", close: "18:00", closed: false };
                  return (
                    <div key={d.key} className="flex items-center gap-2 rounded-xl border p-2 text-xs">
                      <span className="w-24 font-bold truncate">{d.label}</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={h.closed}
                          onChange={(e) =>
                            setHours({ ...hours, [d.key]: { ...h, closed: e.target.checked } })
                          }
                        />
                        <span>Fechado</span>
                      </label>
                      {!h.closed && (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            type="time"
                            value={h.open}
                            onChange={(e) =>
                              setHours({ ...hours, [d.key]: { ...h, open: e.target.value } })
                            }
                            className="rounded border px-1 py-0.5 text-[11px]"
                          />
                          <span>às</span>
                          <input
                            type="time"
                            value={h.close}
                            onChange={(e) =>
                              setHours({ ...hours, [d.key]: { ...h, close: e.target.value } })
                            }
                            className="rounded border px-1 py-0.5 text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar Alterações
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
