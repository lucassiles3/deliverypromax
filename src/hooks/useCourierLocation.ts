import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Broadcasts the courier's GPS position to the courier_locations table while enabled.
 */
export const useCourierLocationBroadcast = (
  courierId: string | null,
  storeId: string | null,
  enabled: boolean,
) => {
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || !courierId || !storeId) return;
    if (!("geolocation" in navigator)) {
      setError("GPS não disponível neste dispositivo");
      return;
    }

    let lastSent = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        // throttle to one update every 5s
        const now = Date.now();
        if (now - lastSent < 5000) return;
        lastSent = now;
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const { error: upErr } = await supabase.from("courier_locations").upsert(
          {
            courier_id: courierId,
            store_id: storeId,
            lat: latitude,
            lng: longitude,
            accuracy,
            heading,
            speed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "courier_id" },
        );
        if (upErr) setError(upErr.message);
        else {
          setError(null);
          setLastUpdate(new Date());
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, courierId, storeId]);

  return { error, lastUpdate };
};

export type CourierLiveLocation = {
  courier_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
};

/**
 * Subscribes to a courier's live location.
 */
export const useCourierLocation = (courierId: string | null) => {
  const [location, setLocation] = useState<CourierLiveLocation | null>(null);

  useEffect(() => {
    if (!courierId) {
      setLocation(null);
      return;
    }

    // initial fetch
    supabase
      .from("courier_locations")
      .select("courier_id, lat, lng, accuracy, updated_at")
      .eq("courier_id", courierId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLocation(data as CourierLiveLocation);
      });

    const ch = supabase
      .channel(`courier-loc:${courierId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "courier_locations",
          filter: `courier_id=eq.${courierId}`,
        },
        (payload) => {
          if (payload.new) setLocation(payload.new as CourierLiveLocation);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [courierId]);

  return location;
};
