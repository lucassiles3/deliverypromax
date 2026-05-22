import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, ExternalLink, GripVertical } from "lucide-react";
import type { HomeBanner } from "@/hooks/useHomeBanners";

const empty = {
  title: "",
  image_url: "",
  link_url: "",
  position: 0,
  active: true,
};

export default function MasterBanners() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("home_banners")
      .select("*")
      .order("position", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setBanners((data ?? []) as HomeBanner[]);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("home-banners")
      .upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("home-banners").getPublicUrl(path);
    setForm((f: any) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Imagem enviada");
  };

  const save = async () => {
    if (!form.image_url) return toast.error("Envie uma imagem");
    setSaving(true);
    const payload = {
      title: form.title || null,
      image_url: form.image_url,
      link_url: form.link_url || null,
      position: Number(form.position) || 0,
      active: !!form.active,
    };
    const { error } = editingId
      ? await supabase.from("home_banners").update(payload).eq("id", editingId)
      : await supabase.from("home_banners").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Banner atualizado" : "Banner criado");
    resetForm();
    load();
  };

  const edit = (b: HomeBanner) => {
    setEditingId(b.id);
    setForm({
      title: b.title ?? "",
      image_url: b.image_url,
      link_url: b.link_url ?? "",
      position: b.position,
      active: b.active,
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este banner?")) return;
    const { error } = await supabase.from("home_banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Banner removido");
    load();
  };

  const toggle = async (b: HomeBanner) => {
    const { error } = await supabase
      .from("home_banners")
      .update({ active: !b.active })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Editar banner" : "Novo banner"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Imagem (retangular, recomendado 1600x600)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="preview"
                  className="aspect-[16/6] w-full rounded-lg object-cover"
                />
              )}
              <Input
                placeholder="ou cole a URL da imagem"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título (interno)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Promo de inverno"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link (ao clicar no banner)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://... ou /loja/slug"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Posição</Label>
                  <Input
                    type="number"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingId ? "Salvar alterações" : "Adicionar banner"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Banners ({banners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum banner cadastrado.
            </p>
          ) : (
            <div className="space-y-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row gap-3 items-start p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs ml-1">#{b.position}</span>
                  </div>
                  <img
                    src={b.image_url}
                    alt={b.title ?? ""}
                    className="w-40 aspect-[16/6] object-cover rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.title || "—"}</p>
                    {b.link_url && (
                      <a
                        href={b.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="h-3 w-3" /> {b.link_url}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-stretch sm:self-center">
                    <Switch checked={b.active} onCheckedChange={() => toggle(b)} />
                    <Button size="sm" variant="outline" onClick={() => edit(b)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
