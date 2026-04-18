import { createContext, useContext, useState, ReactNode, useMemo } from "react";
import type { Product } from "@/data/stores";

export type CartItem = Product & { quantity: number; storeSlug: string };

type CartContextType = {
  items: CartItem[];
  storeSlug: string | null;
  add: (product: Product, storeSlug: string) => void;
  remove: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);

  const add = (product: Product, slug: string) => {
    setItems((prev) => {
      // Different store -> reset cart
      if (storeSlug && storeSlug !== slug) {
        setStoreSlug(slug);
        return [{ ...product, quantity: 1, storeSlug: slug }];
      }
      if (!storeSlug) setStoreSlug(slug);
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1, storeSlug: slug }];
    });
    setOpen(true);
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) setStoreSlug(null);
      return next;
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return remove(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  };

  const clear = () => {
    setItems([]);
    setStoreSlug(null);
  };

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, storeSlug, add, remove, updateQty, clear, total, count, isOpen, setOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
