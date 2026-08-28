import burger from "@/assets/burger.jpg";
import pizza from "@/assets/pizza.jpg";
import sushi from "@/assets/sushi.jpg";
import fries from "@/assets/fries.jpg";
import soda from "@/assets/soda.jpg";
import dessert from "@/assets/dessert.jpg";

const map: Record<string, string> = { burger, pizza, sushi, fries, soda, dessert };

export const resolveAsset = (key?: string | null): string => {
  if (!key) return dessert;
  if (key.startsWith("http") || key.startsWith("/") || key.startsWith("data:")) return key;
  return map[key] ?? dessert;
};
