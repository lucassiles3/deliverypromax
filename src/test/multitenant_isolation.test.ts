import { describe, it, expect, beforeEach } from "vitest";
import { shouldPersistQuery } from "../lib/queryClient";
import { clearUserSessionState } from "../hooks/useAuth";

describe("Multi-Tenant Isolation & Security Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Query Client Disk Cache Persist Policy (shouldPersistQuery)", () => {
    it("should allow persisting PUBLIC domain data in disk cache", () => {
      expect(shouldPersistQuery(["stores"])).toBe(true);
      expect(shouldPersistQuery(["store", "pizzaria-x"])).toBe(true);
      expect(shouldPersistQuery(["products", "loja-123"])).toBe(true);
      expect(shouldPersistQuery(["categories"])).toBe(true);
      expect(shouldPersistQuery(["home-banners"])).toBe(true);
      expect(shouldPersistQuery(["store-toggles", "loja-123"])).toBe(true);
    });

    it("should BLOCK persisting PRIVATE USER data in disk cache (prevent cross-user leak)", () => {
      expect(shouldPersistQuery(["profile"])).toBe(false);
      expect(shouldPersistQuery(["addresses"])).toBe(false);
      expect(shouldPersistQuery(["user-orders"])).toBe(false);
      expect(shouldPersistQuery(["my-orders"])).toBe(false);
      expect(shouldPersistQuery(["loyalty"])).toBe(false);
      expect(shouldPersistQuery(["favorites"])).toBe(false);
      expect(shouldPersistQuery(["favorite-products"])).toBe(false);
      expect(shouldPersistQuery(["favorite-stores"])).toBe(false);
      expect(shouldPersistQuery(["store-access"])).toBe(false);
    });
  });

  describe("Session Cleanup on SignOut (clearUserSessionState)", () => {
    it("should remove sensitive local storage state on logout", () => {
      localStorage.setItem("ff_cart", JSON.stringify({ items: [{ lineId: "1", storeSlug: "loja-a" }] }));
      localStorage.setItem("ff_last_contact", JSON.stringify({ name: "User A", phone: "11999999999" }));

      clearUserSessionState();

      expect(localStorage.getItem("ff_cart")).toBeNull();
      expect(localStorage.getItem("ff_last_contact")).toBeNull();
    });
  });

  describe("Coupon Multi-Tenant Scope Logic", () => {
    it("should correctly isolate coupons by store_id", () => {
      const allCoupons = [
        { code: "STORE_A_10", store_id: "store-a", active: true },
        { code: "STORE_B_20", store_id: "store-b", active: true },
        { code: "GLOBAL_5", store_id: null, active: true },
      ];

      const filterCouponsForStore = (storeId: string) =>
        allCoupons.filter((c) => c.active && (c.store_id === storeId || c.store_id === null));

      const storeACoupons = filterCouponsForStore("store-a");
      expect(storeACoupons.map((c) => c.code)).toEqual(["STORE_A_10", "GLOBAL_5"]);
      expect(storeACoupons.map((c) => c.code)).not.toContain("STORE_B_20");

      const storeBCoupons = filterCouponsForStore("store-b");
      expect(storeBCoupons.map((c) => c.code)).toEqual(["STORE_B_20", "GLOBAL_5"]);
      expect(storeBCoupons.map((c) => c.code)).not.toContain("STORE_A_10");
    });
  });
});
