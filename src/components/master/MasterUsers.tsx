import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  display_name: string | null;
  phone: string | null;
  created_at: string;
  roles: string[];
};

export default function MasterUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,phone,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const ids = (profiles || []).map((p: any) => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const byUser = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const arr = byUser.get(r.user_id) || [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      });
      setRows((profiles || []).map((p: any) => ({ ...p, roles: byUser.get(p.id) || [] })));
    })();
  }, []);

  const filtered = rows.filter(r =>
    (r.display_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (r.phone || "").includes(q)
  );

  return (
    <div className="space-y-4">
      <Input className="max-w-md" placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Telefone</th>
                <th className="text-left p-3">Papéis</th>
                <th className="text-left p-3">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.display_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.phone || "—"}</td>
                  <td className="p-3 flex gap-1 flex-wrap">
                    {r.roles.length ? r.roles.map(role =>
                      <Badge key={role} variant="outline">{role}</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum usuário.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
