import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HomeBanner = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  position: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export const useHomeBanners = () =>
  useQuery({
    queryKey: ["home-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_banners")
        .select("id, title, image_url, link_url, position, active, starts_at, ends_at")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HomeBanner[];
    },
    staleTime: 60_000,
  });
