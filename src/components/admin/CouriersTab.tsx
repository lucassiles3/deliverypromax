import { useState } from "react";
import { useCouriers, type Courier } from "@/hooks/useCouriers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bike, Car, Truck, Plus, Trash2, Pencil, Mail, Phone, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VEHICLE_OPTIONS = [
  { id: "motorcycle", label: "Moto", icon: Bike },
  { id: "bicycle", label: "Bike", icon: Bike },
  { id: "car", label: "Carro", icon: Car },
  { id: "van", label: "Van", icon: Truck },
];

export const CouriersTab = ({ storeId }: { storeId: string }) => {
  const { data: couriers = [], isLoading, create, update, remove } = useCouriers(storeId);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Entregadores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre entregadores e atribua a pedidos. Eles podem se logar em <code>/entregador</code>.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Novo entregador
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : couriers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <Bike className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <h3 className="font-display text-lg font-bold">Nenhum entregador ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seu primeiro entregador para atribuir a pedidos.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {couriers.map((c) => {
            const Vehicle = VEHICLE_OPTIONS.find((v) => v.id === c.vehicle_type)?.icon ?? Bike;
            return (
              <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <Vehicle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display font-bold">{c.name}</h3>
                      {c.is_online && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600">
                          <CircleDot className="h-2.5 w-2.5" /> Online
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                    )}
                    {c.vehicle_plate && (
                      <div className="mt-0.5 text-xs text-muted-foreground">Placa: {c.vehicle_plate}</div>
                    )}
                    {!c.user_id && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Mail className="h-2.5 w-2.5" /> Sem login vinculado
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) => update.mutate({ id: c.id, active: v })}
                    />
                    {c.active ? "Ativo" : "Inativo"}
                  </label>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover ${c.name}?`)) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <CourierFormModal
          storeId={storeId}
          courier={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (data) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...data });
            else await create.mutateAsync(data);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const CourierFormModal = ({
  storeId,
  courier,
  onClose,
  onSubmit,
}: {
  storeId: string;
  courier: Courier | null;
  onClose: () => void;
  onSubmit: (data: Partial<Courier> & { name: string }) => Promise<void>;
}) => {
  const [name, setName] = useState(courier?.name ?? "");
  const [phone, setPhone] = useState(courier?.phone ?? "");
  const [vehicleType, setVehicleType] = useState(courier?.vehicle_type ?? "motorcycle");
  const [plate, setPlate] = useState(courier?.vehicle_plate ?? "");
  const [email, setEmail] = useState("");
  const [linking, setLinking] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");

    let userId: string | null | undefined = courier?.user_id;
    // If new + email provided, try to find an existing user by email and link
    if (!courier && email.trim()) {
      setLinking(true);
      // We can't query auth.users directly; rely on the courier logging in later and we link via email.
      // For now, just save without user_id; admin can re-edit later when user signs up.
      setLinking(false);
      toast.message("Peça para o entregador criar conta com o email informado, depois edite e vincule.");
    }

    await onSubmit({
      name: name.trim(),
      phone: phone.trim() || null,
      vehicle_type: vehicleType,
      vehicle_plate: plate.trim() || null,
      user_id: userId,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{courier ? "Editar entregador" : "Novo entregador"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <Label>Veículo</Label>
            <div className="mt-1 flex gap-2">
              {VEHICLE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVehicleType(v.id)}
                  className={`flex-1 rounded-xl border-2 p-2 text-xs font-bold transition-smooth ${
                    vehicleType === v.id ? "border-primary bg-primary/5 text-primary" : "border-border"
                  }`}
                >
                  <v.icon className="mx-auto mb-1 h-4 w-4" />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Placa</Label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1234" />
          </div>
          {!courier && (
            <div>
              <Label>Email do entregador (opcional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="entregador@exemplo.com"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Para login, o entregador deve criar conta no app com este email; depois edite o cadastro
                e vincule o usuário.
              </p>
            </div>
          )}
          {courier && !courier.user_id && (
            <LinkUserSection courier={courier} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={linking}>
            {courier ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LinkUserSection = ({ courier }: { courier: Courier }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const link = async () => {
    if (!email.trim()) return;
    setLoading(true);
    // Find profile by display_name OR fallback: ask the user to sign up first.
    // Since profiles doesn't store email, we use a server-side lookup via RPC if available.
    // Simpler approach: we set user_id manually after the courier signs up — admin pastes user's UUID.
    // For now, we accept a UUID directly.
    if (!/^[0-9a-f-]{36}$/i.test(email.trim())) {
      toast.error("Cole o UUID do usuário (peça para ele em /conta).");
      setLoading(false);
      return;
    }
    const { error } = await supabase
      .from("couriers")
      .update({ user_id: email.trim() })
      .eq("id", courier.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Usuário vinculado");
  };
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-3">
      <Label>Vincular usuário (UUID)</Label>
      <div className="mt-1 flex gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="UUID do usuário" />
        <Button type="button" onClick={link} disabled={loading} size="sm">
          Vincular
        </Button>
      </div>
    </div>
  );
};
