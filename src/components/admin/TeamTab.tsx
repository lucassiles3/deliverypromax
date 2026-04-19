import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  Trash2,
  Shield,
  Headset,
  ChefHat,
  Bike,
  Clock,
  Activity,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

type StaffRole = "manager" | "attendant" | "kitchen" | "courier";

const ROLE_META: Record<StaffRole, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  manager:   { label: "Gerente",    desc: "Tudo, exceto financeiro e configurações da loja",                  icon: Shield,  color: "bg-primary/10 text-primary" },
  attendant: { label: "Atendente",  desc: "Pedidos e clientes",                                               icon: Headset, color: "bg-blue-500/10 text-blue-600" },
  kitchen:   { label: "Cozinha",    desc: "Apenas o kanban de pedidos",                                       icon: ChefHat, color: "bg-amber-500/10 text-amber-600" },
  courier:   { label: "Entregador", desc: "Apenas pedidos prontos para entrega",                              icon: Bike,    color: "bg-purple-500/10 text-purple-600" },
};

interface Props {
  storeId: string;
}

export const TeamTab = ({ storeId }: Props) => {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("attendant");
  const [sending, setSending] = useState(false);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["store-members", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_members")
        .select("id, user_id, role, display_name, active, joined_at")
        .eq("store_id", storeId)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["store-invites", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_invites")
        .select("id, email, role, display_name, accepted_at, expires_at, created_at")
        .eq("store_id", storeId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["staff-activity", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_activity_log")
        .select("id, user_label, action, entity_type, entity_id, metadata, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["member-profiles", memberIds.join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .in("id", memberIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { display_name: string | null; phone: string | null }>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const sendInvite = async () => {
    if (!email.trim()) return toast.error("Informe um email");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          store_id: storeId,
          email: email.trim(),
          role,
          display_name: name.trim() || null,
        },
      });
      if (error) throw error;
      const msg =
        data?.mode === "linked"
          ? "Pessoa vinculada à loja."
          : data?.mode === "invited"
          ? "Convite enviado por email."
          : data?.warning ?? "Convite registrado.";
      toast.success(msg);
      setEmail("");
      setName("");
      setRole("attendant");
      setInviteOpen(false);
      qc.invalidateQueries({ queryKey: ["store-members", storeId] });
      qc.invalidateQueries({ queryKey: ["store-invites", storeId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar convite");
    } finally {
      setSending(false);
    }
  };

  const updateRole = async (id: string, newRole: StaffRole) => {
    const { error } = await supabase
      .from("store_members")
      .update({ role: newRole })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["store-members", storeId] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("store_members")
      .update({ active: !active })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Membro pausado" : "Membro reativado");
    qc.invalidateQueries({ queryKey: ["store-members", storeId] });
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    const { error } = await supabase.from("store_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Membro removido");
    qc.invalidateQueries({ queryKey: ["store-members", storeId] });
  };

  const cancelInvite = async (id: string) => {
    const { error } = await supabase.from("store_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Convite cancelado");
    qc.invalidateQueries({ queryKey: ["store-invites", storeId] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Equipe</h2>
          <p className="text-sm text-muted-foreground">
            Convide pessoas para ajudar a operar a loja com permissões específicas.
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar para a equipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="pessoa@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Nome (opcional)</Label>
                <Input
                  placeholder="Como você chama essa pessoa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_META) as StaffRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        <div className="flex flex-col text-left">
                          <span className="font-bold">{ROLE_META[r].label}</span>
                          <span className="text-xs text-muted-foreground">{ROLE_META[r].desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Um magic link será enviado por email. Se a pessoa já tiver conta, será vinculada automaticamente.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={sendInvite} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Membros */}
      <section className="rounded-2xl bg-card shadow-soft">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-display text-lg font-bold">Membros ativos</h3>
          <span className="text-xs text-muted-foreground">{members.length}</span>
        </header>
        {loadingMembers ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum membro ainda. Convide alguém para começar.
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const meta = ROLE_META[m.role as StaffRole];
              const Icon = meta.icon;
              const profile = profileMap.get(m.user_id);
              const displayName = m.display_name || profile?.display_name || "Sem nome";
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{displayName}</span>
                      {!m.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                          Pausado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {profile?.phone ?? "—"} • Entrou em{" "}
                      {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as StaffRole)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_META) as StaffRole[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(m.id, m.active)}>
                    {m.active ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <section className="rounded-2xl bg-card shadow-soft">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Mail className="h-4 w-4" /> Convites pendentes
            </h3>
            <span className="text-xs text-muted-foreground">{invites.length}</span>
          </header>
          <ul className="divide-y">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_META[inv.role as StaffRole].label} • Expira em{" "}
                    {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => cancelInvite(inv.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Atividade */}
      <section className="rounded-2xl bg-card shadow-soft">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Atividade da equipe
          </h3>
          <span className="text-xs text-muted-foreground">Últimas 50 ações</span>
        </header>
        {activity.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <ul className="divide-y">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="font-bold">{a.user_label ?? "Sistema"}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>
                  {a.entity_type && (
                    <span className="text-muted-foreground"> • {a.entity_type}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
