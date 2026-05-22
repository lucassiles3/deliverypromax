import { supabase } from "@/integrations/supabase/client";

/** Registra uma visita a uma loja parceira (external listing). */
export async function trackListingVisit(listingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("external_listing_visits" as any).insert({
      listing_id: listingId,
      user_id: user?.id ?? null,
    });
  } catch (e) {
    // silencioso — não bloquear navegação
    console.warn("trackListingVisit failed", e);
  }
}
