import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { formatCep, lookupCep, geocodeAddress } from "@/lib/cep";
import { toast } from "@/hooks/use-toast";

const DISMISS_KEY = "ff_location_gate_dismissed";

interface Props {
  hasCoords: boolean;
  requesting: boolean;
  onUseGps: () => void;
  onManual: (lat: number, lng: number) => void;
}

export const LocationGate = ({ hasCoords, requesting, onUseGps, onManual }: Props) => {
  const [open, setOpen] = useState(false);
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasCoords) {
      setOpen(false);
      return;
    }
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setOpen(true);
  }, [hasCoords]);

  const handleCep = async () => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      toast({ description: "Digite um CEP válido (8 dígitos)", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await lookupCep(digits);
      if (!r) {
        toast({ description: "CEP não encontrado", variant: "destructive" });
        return;
      }
      const q = [r.street, r.neighborhood, r.city, r.state, "Brasil"].filter(Boolean).join(", ");
      const c = await geocodeAddress(q);
      if (!c) {
        toast({ description: "Não foi possível localizar este CEP no mapa", variant: "destructive" });
        return;
      }
      onManual(c.lat, c.lng);
      localStorage.setItem(DISMISS_KEY, "1");
      toast({ description: `📍 Localização definida: ${r.city}/${r.state}` });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGps = () => {
    onUseGps();
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const skip = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Onde você está?
          </DialogTitle>
          <DialogDescription>
            Para mostrar as lojas certas perto de você, autorize o GPS ou informe seu CEP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            onClick={handleGps}
            disabled={requesting}
            className="w-full gradient-primary text-primary-foreground"
          >
            {requesting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="mr-1.5 h-4 w-4" />
            )}
            Usar minha localização (GPS)
          </Button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Informe seu CEP</label>
            <div className="flex gap-2">
              <Input
                value={cep}
                onChange={(e) => setCep(formatCep(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleCep()}
                placeholder="00000-000"
                maxLength={9}
                inputMode="numeric"
              />
              <Button onClick={handleCep} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Não compartilhamos sua localização — usamos só para encontrar lojas próximas.
            </p>
          </div>

          <button
            type="button"
            onClick={skip}
            className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
