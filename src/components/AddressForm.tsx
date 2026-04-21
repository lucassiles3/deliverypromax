import { useState } from "react";
import { Crosshair, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LocationPicker } from "@/components/LocationPicker";
import { lookupCep, formatCep, reverseGeocode, geocodeAddress } from "@/lib/cep";
import { toast } from "@/hooks/use-toast";
import type { AddressInput } from "@/hooks/useAddresses";

const vibrate = (ms = 30) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

export const emptyAddressForm: AddressInput = {
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

interface AddressFormProps {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

export const AddressForm = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Salvar endereço",
}: AddressFormProps) => {
  const [locating, setLocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);

  const set = (patch: Partial<AddressInput>) => onChange({ ...value, ...patch });

  const applyReverse = async (lat: number, lng: number) => {
    const r = await reverseGeocode(lat, lng);
    if (!r) {
      toast({ description: "Não foi possível detectar o endereço — preencha manualmente." });
      onChange({ ...value, lat, lng });
      return;
    }
    onChange({
      ...value,
      lat,
      lng,
      cep: r.cep || value.cep,
      street: r.street || value.street,
      number: r.number || value.number,
      neighborhood: r.neighborhood || value.neighborhood,
      city: r.city || value.city,
      state: r.state || value.state,
      country: r.country || value.country,
    });
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      toast({ description: "Geolocalização indisponível neste dispositivo", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        vibrate();
        await applyReverse(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        toast({ description: "📍 Localização detectada" });
      },
      (err) => {
        setLocating(false);
        toast({
          description: err.code === 1 ? "Permissão negada — ative o GPS" : "Não foi possível obter sua localização",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const onCepChange = async (raw: string) => {
    const formatted = formatCep(raw);
    set({ cep: formatted });
    if (raw.replace(/\D/g, "").length === 8) {
      const r = await lookupCep(raw);
      if (r) {
        const next: AddressInput = {
          ...value,
          cep: formatted,
          street: r.street || value.street,
          neighborhood: r.neighborhood || value.neighborhood,
          city: r.city || value.city,
          state: r.state || value.state,
        };
        const q = [r.street, r.neighborhood, r.city, r.state, "Brasil"].filter(Boolean).join(", ");
        const c = await geocodeAddress(q);
        onChange(c ? { ...next, lat: c.lat, lng: c.lng } : next);
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

  const handleSubmit = () => {
    if (!value.cep || !value.street || !value.number) {
      toast({ description: "Preencha CEP, rua e número", variant: "destructive" });
      return;
    }
    onSubmit();
  };

  return (
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

      <LocationPicker
        value={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : null}
        onChange={(c) => {
          vibrate(15);
          applyReverse(c.lat, c.lng);
        }}
      />

      <div>
        <Label>Tipo</Label>
        <div className="mt-1 flex gap-2">
          {["Casa", "Trabalho", "Outro"].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set({ label: l })}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                value.label === l
                  ? "border-transparent gradient-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CEP *</Label>
          <Input value={value.cep} onChange={(e) => onCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
        </div>
        <div>
          <Label>Número *</Label>
          <Input value={value.number} onChange={(e) => set({ number: e.target.value })} maxLength={10} placeholder="123" />
        </div>
      </div>
      <div>
        <Label>Rua *</Label>
        <Input value={value.street} onChange={(e) => set({ street: e.target.value })} maxLength={200} placeholder="Rua / Avenida" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Bairro</Label>
          <Input value={value.neighborhood ?? ""} onChange={(e) => set({ neighborhood: e.target.value })} maxLength={100} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={value.city ?? ""} onChange={(e) => set({ city: e.target.value })} maxLength={100} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Estado</Label>
          <Input value={value.state ?? ""} onChange={(e) => set({ state: e.target.value })} maxLength={50} placeholder="UF" />
        </div>
        <div>
          <Label>País</Label>
          <Input value={value.country ?? ""} onChange={(e) => set({ country: e.target.value })} maxLength={50} />
        </div>
      </div>
      <div>
        <Label>Complemento (apto, bloco, portão)</Label>
        <Input value={value.complement ?? ""} onChange={(e) => set({ complement: e.target.value })} maxLength={120} />
      </div>
      <div>
        <Label>Ponto de referência</Label>
        <Input
          value={value.reference ?? ""}
          onChange={(e) => set({ reference: e.target.value })}
          placeholder="Ex: portão azul, ao lado da padaria"
          maxLength={200}
        />
      </div>

      <label className="flex items-center justify-between rounded-md border p-3">
        <span className="text-sm font-medium">Definir como endereço padrão</span>
        <Switch checked={!!value.is_default} onCheckedChange={(v) => set({ is_default: v })} />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={submitting} className="gradient-primary text-primary-foreground">
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
