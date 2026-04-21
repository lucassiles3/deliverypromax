import { useState } from "react";
import { Navigate } from "react-router-dom";
import { MapPin, Plus, Pencil, Trash2, Home as HomeIcon, Briefcase, MapPinned, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useAddresses, useSaveAddress, useDeleteAddress, type AddressInput } from "@/hooks/useAddresses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddressForm, emptyAddressForm } from "@/components/AddressForm";

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
  const [form, setForm] = useState<AddressInput>(emptyAddressForm);

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const reset = () => {
    setForm(emptyAddressForm);
    setEditId(null);
  };

  const handleSubmit = () => {
    save.mutate(
      { ...form, id: editId ?? undefined },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
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

  const showInlineForm = !isLoading && addresses.length === 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container max-w-3xl py-6">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold md:text-3xl">Meus endereços</h1>
          </div>
          {addresses.length > 0 && (
            <Button onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo endereço
            </Button>
          )}
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
        ) : showInlineForm ? (
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold">Cadastre seu primeiro endereço</h2>
              <p className="text-sm text-muted-foreground">
                Use o GPS, o CEP ou preencha manualmente os campos abaixo.
              </p>
            </div>
            <AddressForm
              value={form}
              onChange={setForm}
              onSubmit={handleSubmit}
              submitting={save.isPending}
              submitLabel="Cadastrar endereço"
            />
          </Card>
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
                          {a.street}, {a.number}
                          {a.complement ? `, ${a.complement}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.neighborhood} — {a.city}
                          {a.state ? `/${a.state}` : ""} • CEP {a.cep}
                        </p>
                        {a.reference && <p className="mt-1 text-xs text-muted-foreground">📌 {a.reference}</p>}
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar endereço" : "Novo endereço"}</DialogTitle>
          </DialogHeader>
          <AddressForm
            value={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            submitting={save.isPending}
            submitLabel={editId ? "Salvar alterações" : "Cadastrar endereço"}
          />
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Enderecos;
