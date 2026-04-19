import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type AddonOption = {
  id: string;
  name: string;
  price: number;
  position: number;
  _new?: boolean;
};

type AddonGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  min_select: number;
  max_select: number | null;
  position: number;
  options: AddonOption[];
  _new?: boolean;
  _expanded?: boolean;
};

export const AddonGroupsEditor = ({ productId }: { productId: string }) => {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!productId) return;
    (async () => {
      setLoading(true);
      const { data: gs, error } = await supabase
        .from("addon_groups")
        .select("id, name, type, required, min_select, max_select, position, addon_options(id, name, price, position)")
        .eq("product_id", productId)
        .order("position");
      if (error) toast.error(error.message);
      const parsed: AddonGroup[] = (gs ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        required: g.required,
        min_select: g.min_select ?? 0,
        max_select: g.max_select,
        position: g.position ?? 0,
        options: (g.addon_options ?? [])
          .map((o: any) => ({ id: o.id, name: o.name, price: Number(o.price), position: o.position ?? 0 }))
          .sort((a: AddonOption, b: AddonOption) => a.position - b.position),
        _expanded: true,
      }));
      setGroups(parsed);
      setLoading(false);
    })();
  }, [productId]);

  const persistGroup = async (g: AddonGroup) => {
    const payload = {
      product_id: productId,
      name: g.name,
      type: g.type,
      required: g.min_select > 0,
      min_select: g.min_select,
      max_select: g.type === "single" ? 1 : g.max_select,
      position: g.position,
    };
    if (g._new) {
      const { data, error } = await supabase.from("addon_groups").insert(payload).select().single();
      if (error) return toast.error(error.message);
      setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, id: data.id, _new: false } : x)));
      return data.id as string;
    }
    const { error } = await supabase.from("addon_groups").update(payload).eq("id", g.id);
    if (error) toast.error(error.message);
    return g.id;
  };

  const persistOption = async (groupId: string, o: AddonOption) => {
    const payload = { group_id: groupId, name: o.name, price: o.price, position: o.position };
    if (o._new) {
      const { data, error } = await supabase.from("addon_options").insert(payload).select().single();
      if (error) return toast.error(error.message);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, options: g.options.map((x) => (x.id === o.id ? { ...x, id: data.id, _new: false } : x)) }
            : g
        )
      );
      return;
    }
    const { error } = await supabase.from("addon_options").update(payload).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        name: "Novo grupo",
        type: "single",
        required: false,
        min_select: 0,
        max_select: 1,
        position: prev.length,
        options: [],
        _new: true,
        _expanded: true,
      },
    ]);
  };

  const removeGroup = async (id: string) => {
    if (!confirm("Remover este grupo?")) return;
    const g = groups.find((x) => x.id === id);
    if (g && !g._new) {
      const { error } = await supabase.from("addon_groups").delete().eq("id", id);
      if (error) return toast.error(error.message);
    }
    setGroups((prev) => prev.filter((x) => x.id !== id));
  };

  const updateGroup = (id: string, patch: Partial<AddonGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const addOption = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  id: `tmp-${crypto.randomUUID()}`,
                  name: "Nova opção",
                  price: 0,
                  position: g.options.length,
                  _new: true,
                },
              ],
            }
          : g
      )
    );
  };

  const removeOption = async (groupId: string, optId: string) => {
    const g = groups.find((x) => x.id === groupId);
    const o = g?.options.find((x) => x.id === optId);
    if (o && !o._new) {
      const { error } = await supabase.from("addon_options").delete().eq("id", optId);
      if (error) return toast.error(error.message);
    }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, options: g.options.filter((x) => x.id !== optId) } : g))
    );
  };

  const updateOption = (groupId: string, optId: string, patch: Partial<AddonOption>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) }
          : g
      )
    );
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.id === active.id);
    const newIdx = groups.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(groups, oldIdx, newIdx).map((g, i) => ({ ...g, position: i }));
    setGroups(reordered);
    // persist positions
    await Promise.all(
      reordered.filter((g) => !g._new).map((g) => supabase.from("addon_groups").update({ position: g.position }).eq("id", g.id))
    );
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando adicionais...</p>;

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {groups.map((g) => (
            <SortableGroup
              key={g.id}
              group={g}
              onPatch={(patch) => updateGroup(g.id, patch)}
              onPersist={() => persistGroup(g)}
              onRemove={() => removeGroup(g.id)}
              onAddOption={() => addOption(g.id)}
              onRemoveOption={(optId) => removeOption(g.id, optId)}
              onPatchOption={(optId, patch) => updateOption(g.id, optId, patch)}
              onPersistOption={(o) => persistOption(g.id, o)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addGroup}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Adicionar grupo de adicionais
      </button>
    </div>
  );
};

const SortableGroup = ({
  group,
  onPatch,
  onPersist,
  onRemove,
  onAddOption,
  onRemoveOption,
  onPatchOption,
  onPersistOption,
}: {
  group: AddonGroup;
  onPatch: (p: Partial<AddonGroup>) => void;
  onPersist: () => Promise<string | undefined>;
  onRemove: () => void;
  onAddOption: () => void;
  onRemoveOption: (optId: string) => void;
  onPatchOption: (optId: string, p: Partial<AddonOption>) => void;
  onPersistOption: (o: AddonOption) => Promise<void>;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const expanded = group._expanded ?? true;

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border-2 bg-background">
      <div className="flex items-center gap-2 p-3">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" type="button">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onPatch({ _expanded: !expanded })}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <input
          value={group.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          onBlur={onPersist}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm font-bold outline-none focus:border-primary"
        />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
          {group.options.length} opções
        </span>
        <button type="button" onClick={onRemove} className="rounded p-1 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/30 p-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label className="space-y-1">
              <span className="block font-bold uppercase text-muted-foreground">Tipo</span>
              <select
                value={group.type}
                onChange={(e) => {
                  const type = e.target.value as "single" | "multi";
                  onPatch({ type, max_select: type === "single" ? 1 : group.max_select ?? 99 });
                }}
                onBlur={onPersist}
                className="w-full rounded-md border bg-background px-2 py-1.5"
              >
                <option value="single">Escolha 1 (radio)</option>
                <option value="multi">Múltipla (checkbox)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block font-bold uppercase text-muted-foreground">Mínimo</span>
              <input
                type="number"
                min={0}
                value={group.min_select}
                onChange={(e) => onPatch({ min_select: Math.max(0, Number(e.target.value)) })}
                onBlur={onPersist}
                className="w-full rounded-md border bg-background px-2 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="block font-bold uppercase text-muted-foreground">Máximo</span>
              <input
                type="number"
                min={1}
                value={group.max_select ?? ""}
                disabled={group.type === "single"}
                onChange={(e) => onPatch({ max_select: e.target.value === "" ? null : Number(e.target.value) })}
                onBlur={onPersist}
                className="w-full rounded-md border bg-background px-2 py-1.5 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            {group.options.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  value={o.name}
                  onChange={(e) => onPatchOption(o.id, { name: e.target.value })}
                  onBlur={async () => {
                    if (group._new) await onPersist();
                    await onPersistOption(o);
                  }}
                  placeholder="Nome da opção"
                  className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    step="0.10"
                    min={0}
                    value={o.price}
                    onChange={(e) => onPatchOption(o.id, { price: Number(e.target.value) })}
                    onBlur={async () => {
                      if (group._new) await onPersist();
                      await onPersistOption(o);
                    }}
                    className="w-20 rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveOption(o.id)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddOption}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed py-1.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-3 w-3" /> Adicionar opção
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
