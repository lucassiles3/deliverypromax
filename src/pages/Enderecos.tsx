import { useState } from "react";
import { Navigate } from "react-router-dom";
import { MapPin, Plus, Pencil, Trash2, Home as HomeIcon, Briefcase, MapPinned, Loader2 } from "lucide-react";
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
import { lookupCep, formatCep } from "@/lib/cep";
import { toast } from "@/hooks/use-toast";

const labelIcon = (label?: string | null) => {
  if (label === "Casa") return HomeIcon;
  if (label === "Trabalho") return Briefcase;
  return MapPinned;
};

const Enderecos = () => {
  const { user, loading } = useAuth();
  const { data: addresses = [], isLoading } = useAddresses();
  const save = useSaveAddress();
  const del = useDeleteAddress();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>({
    label: "Casa",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    is_default: false,
  });

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const reset = () => {
    setForm({ label: "Casa", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", is_default: false });
    setEditId(null);
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
        }));
      } else {
        toast({ description: "CEP não encontrado" });
      }
    }
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
      is_default: a.is_default,
    });
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container max-w-3xl py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold md:text-3xl">Meus endereços</h1>
          </div>
          <Button onClick={() => { reset(); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
        ) : addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Nenhum endereço cadastrado
          </div>
        ) : (
          <ul className="space-y-3">
            {addresses.map((a) => {
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
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.street}, {a.number}{a.complement ? `, ${a.complement}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.neighborhood} — {a.city} • CEP {a.cep}
                        </p>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar endereço" : "Novo endereço"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
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
            <div>
              <Label>Complemento / Referência</Label>
              <Input value={form.complement ?? ""} onChange={(e) => setForm({ ...form, complement: e.target.value })} maxLength={120} />
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
