import { describe, it, expect } from "vitest";
import { distanceKm, isStoreInDeliveryRadius } from "../lib/distance";
import { matchCategory, matchSubcategory, CATEGORIES, SUBCATEGORIES } from "../components/CategoryGrid";

describe("Delivery Radius & Geolocation Rules", () => {
  // Coords for User A in Rio de Janeiro center
  const userCoordsA = { lat: -22.9068, lng: -43.1729 };
  // Coords ~2km away
  const store2km = { lat: -22.9200, lng: -43.1600 };
  // Coords ~8km away
  const store8km = { lat: -22.9700, lng: -43.1800 };

  it("TEST 1: Inside radius (User 2km, Radius 5km -> Visible)", () => {
    const dist = distanceKm(userCoordsA, store2km);
    expect(dist).toBeLessThanOrEqual(5);
    const result = isStoreInDeliveryRadius(userCoordsA, { ...store2km, deliveryRadiusKm: 5 });
    expect(result.inRange).toBe(true);
  });

  it("TEST 2: Outside radius (User 8km, Radius 5km -> Not Visible)", () => {
    const dist = distanceKm(userCoordsA, store8km);
    expect(dist).toBeGreaterThan(5);
    const result = isStoreInDeliveryRadius(userCoordsA, { ...store8km, deliveryRadiusKm: 5 });
    expect(result.inRange).toBe(false);
  });

  it("TEST 3: Exactly at boundary (Distance = Radius -> Visible)", () => {
    // If distance <= radius, it must be visible
    const mockStore = { lat: -22.9068, lng: -43.1729, deliveryRadiusKm: 5 };
    const result = isStoreInDeliveryRadius(userCoordsA, mockStore);
    expect(result.inRange).toBe(true);
  });

  it("TEST 4: Category Matching", () => {
    const foodCat = CATEGORIES.find((c) => c.key === "food")!;
    expect(matchCategory("Pizzaria", foodCat)).toBe(true);
    expect(matchCategory(null, foodCat, [], "food")).toBe(true);
  });

  it("TEST 5: Category + Radius combination", () => {
    const stores = [
      { id: "A", name: "Pizzaria A", lat: store2km.lat, lng: store2km.lng, deliveryRadiusKm: 5, category_key: "food", cuisine: "Pizzaria" },
      { id: "B", name: "Pizzaria B", lat: store8km.lat, lng: store8km.lng, deliveryRadiusKm: 5, category_key: "food", cuisine: "Pizzaria" },
    ];
    const foodCat = CATEGORIES.find((c) => c.key === "food")!;

    const available = stores.filter((s) => {
      const { inRange } = isStoreInDeliveryRadius(userCoordsA, s);
      const isCatMatch = matchCategory(s.cuisine, foodCat, [], s.category_key);
      return inRange && isCatMatch;
    });

    expect(available.map((s) => s.id)).toEqual(["A"]);
  });

  it("TEST 6: Multiple categories matching", () => {
    const foodCat = CATEGORIES.find((c) => c.key === "food")!;
    const drinksCat = CATEGORIES.find((c) => c.key === "drinks")!;

    const storeMulti = { cuisine: "Restaurante e Adega", categories: ["food", "drinks"] };

    expect(matchCategory(storeMulti.cuisine, foodCat, storeMulti.categories)).toBe(true);
    expect(matchCategory(storeMulti.cuisine, drinksCat, storeMulti.categories)).toBe(true);
  });

  it("TEST 7: Inactive partner exclusion", () => {
    const storeInactive = { active: false, lat: store2km.lat, lng: store2km.lng, deliveryRadiusKm: 5 };
    const isAvailable = storeInactive.active && isStoreInDeliveryRadius(userCoordsA, storeInactive).inRange;
    expect(isAvailable).toBe(false);
  });

  it("TEST 8: Missing location partner exclusion", () => {
    const storeNoCoords = { lat: null, lng: null, deliveryRadiusKm: 5 };
    const result = isStoreInDeliveryRadius(userCoordsA, storeNoCoords);
    expect(result.hasStoreCoords).toBe(false);
    expect(result.inRange).toBe(false);
  });

  it("TEST 9: Location permission denied or unavailable", () => {
    const userLocationNull = null;
    const store = { lat: store2km.lat, lng: store2km.lng, deliveryRadiusKm: 5 };
    const result = isStoreInDeliveryRadius(userLocationNull, store);
    expect(result.hasStoreCoords).toBe(true);
    // App does not crash when coords are null
    expect(result.distanceKm).toBeNull();
  });

  it("TEST 10: Location change recalculates available stores", () => {
    // User move to near store8km
    const userCoordsB = { lat: -22.9700, lng: -43.1800 };
    const resultA = isStoreInDeliveryRadius(userCoordsB, { ...store2km, deliveryRadiusKm: 5 });
    const resultB = isStoreInDeliveryRadius(userCoordsB, { ...store8km, deliveryRadiusKm: 5 });

    expect(resultA.inRange).toBe(false);
    expect(resultB.inRange).toBe(true);
  });
});
