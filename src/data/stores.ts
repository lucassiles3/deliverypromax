// Domain types — data now lives in the database (see /src/hooks/useStores.ts).

export type AddonOption = { id: string; name: string; price: number };
export type AddonGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required?: boolean;
  max?: number;
  options: AddonOption[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  bestseller?: boolean;
  promo?: boolean;
  addonGroups?: AddonGroup[];
};

export type DayHours = { open: string; close: string } | null;
export type OpeningHours = {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours;
  fri: DayHours; sat: DayHours; sun: DayHours;
};

export type Store = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  cuisine: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  deliveryFee: number;
  freeShippingThreshold: number;
  minOrder: number;
  cover: string;
  logo: string;
  city: string;
  open: boolean;
  promo?: string;
  categories: string[];
  products: Product[];
  whatsappPhone?: string;
  openingHours?: OpeningHours;
};

export type Coupon = {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minOrder?: number;
  label: string;
};
