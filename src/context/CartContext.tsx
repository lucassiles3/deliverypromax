import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from "react";
import type { Product, AddonOption } from "@/data/stores";

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

  // persist cart
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ff_cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setStoreSlug(parsed.storeSlug ?? null);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("ff_cart", JSON.stringify({ items, storeSlug }));
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
