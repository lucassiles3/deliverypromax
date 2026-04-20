import { useState } from "react";
import { Navigate } from "react-router-dom";
import { MapPin, Plus, Pencil, Trash2, Home as HomeIcon, Briefcase, MapPinned, Loader2, Crosshair, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useAddresses, useSaveAddress, useDeleteAddress, type AddressInput } from "@/hooks/useAddresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LocationPicker } from "@/components/LocationPicker";
import { lookupCep, formatCep, reverseGeocode, geocodeAddress } from "@/lib/cep";
import { toast } from "@/hooks/use-toast";

const labelIcon = (label?: string | null) => {
  if (label === "Casa") return HomeIcon;
  if (label === "Trabalho") return Briefcase;
  return MapPinned;
};

const emptyForm: AddressInput = {
  label: "Casa",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
  reference: "",
  lat: null,
  lng: null,
  is_default: false,
};

const vibrate = (ms = 30) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

const Enderecos = () => {
  const { user, loading } = useAuth();
  const { data: addresses = [], isLoading } = useAddresses();
  const save = useSaveAddress();
  const del = useDeleteAddress();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [locating, setLocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const reset = () => {
    setForm(emptyForm);
    setEditId(null);
    setSearchTerm("");
  };

  const applyReverse = async (lat: number, lng: number) => {
    const r = await reverseGeocode(lat, lng);
    if (!r) {
      toast({ description: "Não foi possível detectar o endereço — preencha manualmente." });
      return;
    }
    setForm((f) => ({
      ...f,
      lat,
      lng,
      cep: r.cep || f.cep,
      street: r.street || f.street,
      number: r.number || f.number,
      neighborhood: r.neighborhood || f.neighborhood,
      city: r.city || f.city,
      state: r.state || f.state,
      country: r.country || f.country,
    }));
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      toast({ description: "Geolocalização indisponível neste dispositivo", variant: "destructive" });
      return;
    }
    setLocating(true);
    if (!open) setOpen(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        vibrate();
        await applyReverse(lat, lng);
        setLocating(false);
        toast({ description: "📍 Localização detectada" });
      },
      (err) => {
        setLocating(false);
        toast({ description: err.code === 1 ? "Permissão negada — ative o GPS" : "Não foi possível obter sua localização", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const onMapChange = (c: { lat: number; lng: number }) => {
    vibrate(15);
    applyReverse(c.lat, c.lng);
  };

  const onCepChange = async (raw: string) => {
    const formatted = formatCep(raw);
    setForm((f) => ({ ...f, cep: formatted }));
    if (raw.replace(/\D/g, "").length === 8) {
      const r = await lookupCep(raw);
      if (r) {
        setForm((f) => ({
          ...f,
          street: r.street || f.street,
          neighborhood: r.neighborhood || f.neighborhood,
          city: r.city || f.city,
          state: r.state || f.state,
        }));
        // tenta geocodar para também colocar pino no mapa
        const q = [r.street, r.neighborhood, r.city, r.state, "Brasil"].filter(Boolean).join(", ");
        const c = await geocodeAddress(q);
        if (c) setForm((f) => ({ ...f, lat: c.lat, lng: c.lng }));
      } else {
        toast({ description: "CEP não encontrado" });
      }
    }
  };

  const onSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const c = await geocodeAddress(searchTerm);
    setSearching(false);
    if (!c) {
      toast({ description: "Endereço não encontrado", variant: "destructive" });
      return;
    }
    await applyReverse(c.lat, c.lng);
  };

  const onEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      label: a.label,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement,
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      country: a.country ?? "Brasil",
      reference: a.reference,
      lat: a.lat,
      lng: a.lng,
      is_default: a.is_default,
    });
    setOpen(true);
  };

  const startNew = () => {
    reset();
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container max-w-3xl py-6">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold md:text-3xl">Meus endereços</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { reset(); setOpen(true); useGps(); }}>
              <Crosshair className="mr-1 h-4 w-4" /> GPS
            </Button>
            <Button onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
        ) : addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="mb-4">Nenhum endereço cadastrado</p>
            <Button onClick={() => { reset(); setOpen(true); useGps(); }} className="gradient-primary text-primary-foreground">
              <Crosshair className="mr-1.5 h-4 w-4" /> Usar minha localização
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {addresses.map((a: any) => {
              const Icon = labelIcon(a.label);
              return (
                <li key={a.id}>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold">{a.label || "Endereço"}</p>
                          {a.is_default && (
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                              Padrão
                            </span>
                          )}
                          {a.lat && a.lng && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              📍 GPS
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.street}, {a.number}{a.complement ? `, ${a.complement}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.neighborhood} — {a.city}{a.state ? `/${a.state}` : ""} • CEP {a.cep}
                        </p>
                        {a.reference && (
                          <p className="mt-1 text-xs text-muted-foreground">📌 {a.reference}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onEdit(a)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirm("Remover este endereço?") && del.mutate(a.id)}
                          className="rounded-md p-1.5 hover:bg-muted"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar endereço" : "Novo endereço"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* GPS + busca */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
              <Button
                type="button"
                onClick={useGps}
                disabled={locating}
                className="w-full gradient-primary text-primary-foreground"
              >
                <Crosshair className="mr-1.5 h-4 w-4" />
                {locating ? "Localizando..." : "📌 Usar minha localização atual"}
              </Button>
              <div className="mt-2 flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSearch())}
                  placeholder="Buscar endereço (rua, número, cidade)"
                  className="bg-background"
                />
                <Button type="button" variant="outline" onClick={onSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                🔒 A localização é usada apenas para melhorar a entrega.
              </p>
            </div>

            {/* Mapa */}
            <LocationPicker
              value={form.lat && form.lng ? { lat: form.lat, lng: form.lng } : null}
              onChange={onMapChange}
            />

            {/* Tipo */}
            <div>
              <Label>Tipo</Label>
              <div className="mt-1 flex gap-2">
                {["Casa", "Trabalho", "Outro"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm({ ...form, label: l })}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      form.label === l ? "border-transparent gradient-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => onCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={10} />
              </div>
            </div>
            <div>
              <Label>Rua</Label>
              <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input value={form.neighborhood ?? ""} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} maxLength={100} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={50} />
              </div>
              <div>
                <Label>País</Label>
                <Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={50} />
              </div>
            </div>
            <div>
              <Label>Complemento (apto, bloco, portão)</Label>
              <Input value={form.complement ?? ""} onChange={(e) => setForm({ ...form, complement: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label>Ponto de referência</Label>
              <Input
                value={form.reference ?? ""}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="Ex: portão azul, ao lado da padaria"
                maxLength={200}
              />
            </div>

            <label className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">Definir como endereço padrão</span>
              <Switch checked={!!form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.cep || !form.street || !form.number) {
                  toast({ description: "Preencha CEP, rua e número", variant: "destructive" });
                  return;
                }
                save.mutate({ ...form, id: editId ?? undefined }, { onSuccess: () => { setOpen(false); reset(); } });
              }}
              disabled={save.isPending}
            >
              Salvar endereço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Enderecos;
