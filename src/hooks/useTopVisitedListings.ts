import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TopVisitedListing = {
  id: string;
  name: string;
  logo: string | null;
  catalog_url: string;
  category_key: string;
  visits: number;
};

export const useTopVisitedListings = (limit = 30) =>
  useQuery({
    queryKey: ["top-visited-listings", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("top_visited_listings" as any, {
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as unknown as TopVisitedListing[];
    },
  });
