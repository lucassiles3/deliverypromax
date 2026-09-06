// Haversine formula — distance between two lat/lng points in km
export const distanceKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export const isStoreInDeliveryRadius = (
  userCoords: { lat: number; lng: number } | null | undefined,
  store: { lat?: number | null; lng?: number | null; deliveryRadiusKm?: number | null; delivery_radius_km?: number | null }
): { inRange: boolean; distanceKm: number | null; hasStoreCoords: boolean } => {
  const storeLat = store.lat != null ? Number(store.lat) : null;
  const storeLng = store.lng != null ? Number(store.lng) : null;
  const hasStoreCoords = storeLat !== null && !isNaN(storeLat) && storeLng !== null && !isNaN(storeLng);

  if (!hasStoreCoords) {
    return { inRange: false, distanceKm: null, hasStoreCoords: false };
  }

  if (!userCoords || userCoords.lat == null || userCoords.lng == null || isNaN(userCoords.lat) || isNaN(userCoords.lng)) {
    return { inRange: true, distanceKm: null, hasStoreCoords: true };
  }

  const dist = distanceKm(userCoords, { lat: storeLat, lng: storeLng });
  const radius = store.deliveryRadiusKm ?? store.delivery_radius_km ?? null;

  if (radius == null || isNaN(radius)) {
    return { inRange: true, distanceKm: dist, hasStoreCoords: true };
  }

  // Exact boundary match dist <= radius returns true
  return { inRange: dist <= radius, distanceKm: dist, hasStoreCoords: true };
};

