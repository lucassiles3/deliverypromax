import burger from "@/assets/burger.jpg";
import pizza from "@/assets/pizza.jpg";
import sushi from "@/assets/sushi.jpg";
import fries from "@/assets/fries.jpg";
import soda from "@/assets/soda.jpg";
import dessert from "@/assets/dessert.jpg";

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
};

export const stores: Store[] = [
  {
    id: "1",
    slug: "burger-fire",
    name: "Burger Fire",
    tagline: "Smash burgers artesanais",
    cuisine: "Hambúrgueres",
    rating: 4.9,
    reviews: 2847,
    deliveryTime: "25-35 min",
    deliveryFee: 6.9,
    freeShippingThreshold: 50,
    minOrder: 20,
    cover: burger,
    logo: "🔥",
    city: "São Paulo",
    open: true,
    promo: "20% OFF no primeiro pedido",
    categories: ["Mais vendidos", "Burgers", "Acompanhamentos", "Bebidas", "Sobremesas"],
    products: [
      { id: "b1", name: "Smash Bacon Duplo", description: "Dois smash burgers, bacon crocante, cheddar derretido e molho da casa", price: 32.9, oldPrice: 42.9, image: burger, category: "Mais vendidos", rating: 4.9, reviews: 1240, bestseller: true, promo: true },
      { id: "b2", name: "Cheese Clássico", description: "Burger 160g, cheddar, alface, tomate e maionese verde", price: 24.9, image: burger, category: "Burgers", rating: 4.8, reviews: 890 },
      { id: "b3", name: "Fritas Crocantes", description: "Batata rústica frita na hora, porção generosa", price: 14.9, image: fries, category: "Acompanhamentos", rating: 4.9, reviews: 654, bestseller: true },
      { id: "b4", name: "Onion Rings", description: "Anéis de cebola empanados, dourados e crocantes", price: 16.9, image: fries, category: "Acompanhamentos", rating: 4.7, reviews: 312 },
      { id: "b5", name: "Coca-Cola Lata", description: "350ml geladinha", price: 6.9, image: soda, category: "Bebidas", rating: 4.9, reviews: 980 },
      { id: "b6", name: "Petit Gâteau", description: "Bolo quente de chocolate com sorvete de creme", price: 18.9, image: dessert, category: "Sobremesas", rating: 5.0, reviews: 421, bestseller: true },
    ],
  },
  {
    id: "2",
    slug: "pizza-nova",
    name: "Pizza Nova",
    tagline: "Pizzas artesanais forno a lenha",
    cuisine: "Pizzaria",
    rating: 4.8,
    reviews: 1932,
    deliveryTime: "35-50 min",
    deliveryFee: 8.9,
    freeShippingThreshold: 70,
    minOrder: 30,
    cover: pizza,
    logo: "🍕",
    city: "São Paulo",
    open: true,
    promo: "Pizza grande + refri por R$59",
    categories: ["Mais vendidos", "Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"],
    products: [
      { id: "p1", name: "Pepperoni Especial", description: "Molho artesanal, mussarela de búfala, pepperoni importado e manjericão", price: 64.9, oldPrice: 79.9, image: pizza, category: "Mais vendidos", rating: 4.9, reviews: 1502, bestseller: true, promo: true },
      { id: "p2", name: "Margherita", description: "Molho de tomate San Marzano, mussarela fresca e manjericão", price: 54.9, image: pizza, category: "Pizzas Salgadas", rating: 4.8, reviews: 845 },
      { id: "p3", name: "Quatro Queijos", description: "Mussarela, gorgonzola, parmesão e provolone", price: 62.9, image: pizza, category: "Pizzas Salgadas", rating: 4.7, reviews: 612 },
      { id: "p4", name: "Chocolate com Morango", description: "Chocolate ao leite, morangos frescos e leite condensado", price: 49.9, image: dessert, category: "Pizzas Doces", rating: 4.9, reviews: 380, bestseller: true },
      { id: "p5", name: "Coca-Cola 2L", description: "Garrafa 2 litros gelada", price: 14.9, image: soda, category: "Bebidas", rating: 4.9, reviews: 720 },
    ],
  },
  {
    id: "3",
    slug: "sushi-zen",
    name: "Sushi Zen",
    tagline: "Sushi premium delivery",
    cuisine: "Japonesa",
    rating: 4.9,
    reviews: 1245,
    deliveryTime: "40-55 min",
    deliveryFee: 9.9,
    freeShippingThreshold: 80,
    minOrder: 40,
    cover: sushi,
    logo: "🍣",
    city: "São Paulo",
    open: true,
    promo: "Combo 30 peças + temaki grátis",
    categories: ["Mais vendidos", "Combinados", "Sashimis", "Bebidas"],
    products: [
      { id: "s1", name: "Combinado Zen 30 peças", description: "Sashimi, niguiri, uramaki e hot roll de salmão", price: 119.9, oldPrice: 149.9, image: sushi, category: "Mais vendidos", rating: 4.9, reviews: 890, bestseller: true, promo: true },
      { id: "s2", name: "Sashimi de Salmão (10un)", description: "Fatias generosas de salmão fresco", price: 54.9, image: sushi, category: "Sashimis", rating: 4.9, reviews: 654, bestseller: true },
      { id: "s3", name: "Combinado Mini 12 peças", description: "Variado de salmão e atum", price: 49.9, image: sushi, category: "Combinados", rating: 4.7, reviews: 432 },
      { id: "s4", name: "Coca-Cola Lata", description: "350ml gelada", price: 7.9, image: soda, category: "Bebidas", rating: 4.8, reviews: 280 },
    ],
  },
  {
    id: "4",
    slug: "doce-mania",
    name: "Doce Mania",
    tagline: "Sobremesas que viciam",
    cuisine: "Sobremesas",
    rating: 4.9,
    reviews: 832,
    deliveryTime: "20-30 min",
    deliveryFee: 5.9,
    freeShippingThreshold: 40,
    minOrder: 15,
    cover: dessert,
    logo: "🍰",
    city: "São Paulo",
    open: true,
    promo: "Compre 2, leve 3 brownies",
    categories: ["Mais vendidos", "Bolos", "Brownies", "Bebidas"],
    products: [
      { id: "d1", name: "Petit Gâteau Premium", description: "Quente com sorvete de baunilha", price: 22.9, image: dessert, category: "Mais vendidos", rating: 5.0, reviews: 612, bestseller: true },
      { id: "d2", name: "Brownie Duplo Chocolate", description: "Cremoso por dentro, crocante por fora", price: 14.9, image: dessert, category: "Brownies", rating: 4.9, reviews: 421 },
    ],
  },
];

export const getStoreBySlug = (slug: string) => stores.find((s) => s.slug === slug);
