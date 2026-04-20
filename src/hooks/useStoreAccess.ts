import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StaffRole = "manager" | "attendant" | "kitchen" | "courier";

export type StoreAccess = {
  id: string;
  name: string;
  logo: string | null;
  slug: string;
  role: "owner" | StaffRole;
};

const SECTION_MATRIX: Record<StaffRole, string[]> = {
  manager: ["dashboard", "orders", "products", "customers", "marketing", "reports", "settings", "pdv", "tables"],
  attendant: ["dashboard", "orders", "customers", "pdv", "tables"],
  kitchen: ["orders", "tables"],
  courier: ["orders"],
};

export const canAccessSection = (
  role: "owner" | StaffRole | null | undefined,
  section: string,
): boolean => {
  if (!role) return false;
  if (role === "owner") return true;
  return SECTION_MATRIX[role]?.includes(section) ?? false;
};

export const useStoreAccess = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["store-access", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StoreAccess[]> => {
      const { data: owned, error: ownErr } = await supabase
        .from("stores")
        .select("id, name, logo, slug, owner_id")
        .eq("owner_id", user!.id);
      if (ownErr) throw ownErr;

      const { data: memberships, error: memErr } = await supabase
        .from("store_members")
        .select("role, store_id, stores:store_id(id, name, logo, slug)")
        .eq("user_id", user!.id)
        .eq("active", true);
      if (memErr) throw memErr;

      const map = new Map<string, StoreAccess>();
      (owned ?? []).forEach((s) =>
        map.set(s.id, { id: s.id, name: s.name, logo: s.logo, slug: s.slug, role: "owner" }),
      );
      (memberships ?? []).forEach((m: any) => {
        if (m.stores && !map.has(m.stores.id)) {
          map.set(m.stores.id, {
            id: m.stores.id,
            name: m.stores.name,
            logo: m.stores.logo,
            slug: m.stores.slug,
            role: m.role,
          });
        }
      });

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
};
