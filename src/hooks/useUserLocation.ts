import { useEffect, useState } from "react";

export type UserCoords = { lat: number; lng: number; source: "gps" | "address" | "fallback" };

const STORAGE_KEY = "ff_user_coords";

export const useUserLocation = (fallback?: { lat: number; lng: number } | null) => {
  const [coords, setCoords] = useState<UserCoords | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  // Apply address fallback whenever it changes (only if no GPS)
  useEffect(() => {
    if (fallback && (!coords || coords.source !== "gps")) {
      setCoords({ lat: fallback.lat, lng: fallback.lng, source: "address" });
    }
  }, [fallback?.lat, fallback?.lng]);

  useEffect(() => {
    if (coords) localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  }, [coords]);

  const requestGps = () => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" });
        setRequesting(false);
        setDenied(false);
      },
      () => {
        setRequesting(false);
        setDenied(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  return { coords, requesting, denied, requestGps };
};
