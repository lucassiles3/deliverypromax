import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from "react";
import type { Product, AddonOption } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";

export type CartCustomization = {
  groupId: string;
  groupName: string;
  selections: AddonOption[];
};

export type CartItem = {
  lineId: string;
  product: Product;
  quantity: number;
  storeSlug: string;
  customizations: CartCustomization[];
  notes?: string;
  unitPrice: number; // base + addons
};

type CartContextType = {
  items: CartItem[];
  storeSlug: string | null;
  addCustom: (
    product: Product,
    storeSlug: string,
    customizations: CartCustomization[],
    quantity: number,
    notes?: string,
  ) => void;
  add: (product: Product, storeSlug: string) => void;
  remove: (lineId: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextType | null>(null);

const lineSignature = (productId: string, customizations: CartCustomization[], notes?: string) =>
  `${productId}|${customizations
    .map((c) => `${c.groupId}:${c.selections.map((s) => s.id).sort().join(",")}`)
    .sort()
    .join("|")}|${notes ?? ""}`;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const storeIdRef = useRef<string | null>(null);
  const syncTimer = useRef<number | null>(null);

  // persist cart locally
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ff_cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setStoreSlug(parsed.storeSlug ?? null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ff_cart", JSON.stringify({ items, storeSlug }));
  }, [items, storeSlug]);

  // capture user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user.id ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      userIdRef.current = session?.user.id ?? null;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // resolve current store id from slug
  useEffect(() => {
    if (!storeSlug) {
      storeIdRef.current = null;
      return;
    }
    supabase
      .from("stores")
      .select("id")
      .eq("slug", storeSlug)
      .maybeSingle()
      .then(({ data }) => {
        storeIdRef.current = data?.id ?? null;
      });
  }, [storeSlug]);

  // sync to abandoned_carts (debounced)
  useEffect(() => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      const uid = userIdRef.current;
      const sid = storeIdRef.current;
      if (!uid || !sid) return;

      if (items.length === 0) {
        // Mark as recovered (or simply remove)
        await supabase.from("abandoned_carts").delete().eq("user_id", uid).eq("store_id", sid);
        return;
      }

      const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const slim = items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes ?? null,
      }));

      await supabase.from("abandoned_carts").upsert(
        {
          user_id: uid,
          store_id: sid,
          items: slim,
          estimated_total: total,
          notified_at: null,
          recovered_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,store_id" },
      );
    }, 1500);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [items, storeSlug]);

  const addCustom: CartContextType["addCustom"] = (product, slug, customizations, quantity, notes) => {
    const addonsTotal = customizations.reduce(
      (s, g) => s + g.selections.reduce((ss, o) => ss + o.price, 0),
      0,
    );
    const unitPrice = product.price + addonsTotal;
    const sig = lineSignature(product.id, customizations, notes);

    setItems((prev) => {
      // Different store -> reset
      if (storeSlug && storeSlug !== slug) {
        setStoreSlug(slug);
        return [
          {
            lineId: `${sig}-${Date.now()}`,
            product,
            quantity,
            storeSlug: slug,
            customizations,
            notes,
            unitPrice,
          },
        ];
      }
      if (!storeSlug) setStoreSlug(slug);

      const existing = prev.find(
        (i) => lineSignature(i.product.id, i.customizations, i.notes) === sig,
      );
      if (existing) {
        return prev.map((i) =>
          i.lineId === existing.lineId ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [
        ...prev,
        {
          lineId: `${sig}-${Date.now()}`,
          product,
          quantity,
          storeSlug: slug,
          customizations,
          notes,
          unitPrice,
        },
      ];
    });
    setOpen(true);
  };

  const add: CartContextType["add"] = (product, slug) => {
    addCustom(product, slug, [], 1);
  };

  const remove = (lineId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.lineId !== lineId);
      if (next.length === 0) setStoreSlug(null);
      return next;
    });
  };

  const updateQty = (lineId: string, qty: number) => {
    if (qty <= 0) return remove(lineId);
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity: qty } : i)));
  };

  const clear = () => {
    // mark as recovered when cart is cleared after checkout
    const uid = userIdRef.current;
    const sid = storeIdRef.current;
    if (uid && sid) {
      supabase
        .from("abandoned_carts")
        .update({ recovered_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("store_id", sid)
        .then(() => undefined);
    }
    setItems([]);
    setStoreSlug(null);
  };

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [items],
  );
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, storeSlug, addCustom, add, remove, updateQty, clear, subtotal, count, isOpen, setOpen }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
