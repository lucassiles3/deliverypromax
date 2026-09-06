import { describe, it, expect } from "vitest";

function normalizeCoords(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Number(lat.toFixed(3)),
    lng: Number(lng.toFixed(3)),
  };
}

function calculateBoundingBox(userLat: number, userLng: number, radiusKm: number) {
  const latDelta = radiusKm / 111.0;
  const cosLat = Math.max(0.01, Math.cos((userLat * Math.PI) / 180));
  const lngDelta = radiusKm / (111.0 * cosLat);

  return {
    minLat: userLat - latDelta,
    maxLat: userLat + latDelta,
    minLng: userLng - lngDelta,
    maxLng: userLng + lngDelta,
  };
}

describe("FASE 2: Coordinate Normalization & Bounding Box Math", () => {
  it("normalizes high-precision GPS coordinates to 3 decimal places (~110m precision)", () => {
    const raw = { lat: -22.9068467123, lng: -43.1728965432 };
    const norm = normalizeCoords(raw.lat, raw.lng);
    expect(norm).toEqual({ lat: -22.907, lng: -43.173 });
  });

  it("filters micro-drift variation into same cache key", () => {
    const raw1 = { lat: -22.906841, lng: -43.172891 };
    const raw2 = { lat: -22.906849, lng: -43.172898 };
    expect(normalizeCoords(raw1.lat, raw1.lng)).toEqual(normalizeCoords(raw2.lat, raw2.lng));
  });

  it("computes accurate Bounding Box limits for 5km radius", () => {
    const userLat = -22.906;
    const userLng = -43.172;
    const bbox = calculateBoundingBox(userLat, userLng, 5);

    expect(bbox.minLat).toBeLessThan(userLat);
    expect(bbox.maxLat).toBeGreaterThan(userLat);
    expect(bbox.minLng).toBeLessThan(userLng);
    expect(bbox.maxLng).toBeGreaterThan(userLng);

    // Verify delta width is approximately ~0.045 degrees for lat
    const latSpan = bbox.maxLat - bbox.minLat;
    expect(latSpan).toBeCloseTo((10 / 111.0), 3);
  });
});
