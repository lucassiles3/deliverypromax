import { useEffect, useState } from "react";
import { getLoyalty, type LoyaltyState } from "@/lib/loyalty";

export const useLoyalty = (): LoyaltyState => {
  const [state, setState] = useState<LoyaltyState>(() => getLoyalty());
  useEffect(() => {
    const update = () => setState(getLoyalty());
    window.addEventListener("ff:loyalty", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("ff:loyalty", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
};
