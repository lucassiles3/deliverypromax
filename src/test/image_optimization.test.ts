import { describe, it, expect } from "vitest";
import { calculateDimensions, optimizeImage } from "../lib/imageOptimization";

describe("Image Optimization Pipeline", () => {
  describe("calculateDimensions", () => {
    it("should NOT upscale small images", () => {
      const result = calculateDimensions(600, 600, 1600, 1600);
      expect(result).toEqual({ targetWidth: 600, targetHeight: 600 });
    });

    it("should scale down large images preserving aspect ratio", () => {
      const result = calculateDimensions(3200, 2400, 1600, 1600);
      expect(result).toEqual({ targetWidth: 1600, targetHeight: 1200 });
    });

    it("should handle banner dimensions correctly", () => {
      const result = calculateDimensions(3840, 2160, 1920, 1080);
      expect(result).toEqual({ targetWidth: 1920, targetHeight: 1080 });
    });

    it("should handle edge cases with invalid input dimensions", () => {
      const result = calculateDimensions(0, 0, 1600, 1600);
      expect(result).toEqual({ targetWidth: 0, targetHeight: 0 });
    });
  });

  describe("optimizeImage Validation", () => {
    it("should reject files larger than max input size (10MB)", async () => {
      const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], "huge.jpg", {
        type: "image/jpeg",
      });

      await expect(optimizeImage(largeFile)).rejects.toThrow(
        "Imagem excede o tamanho máximo permitido"
      );
    });

    it("should return valid result object for small files", async () => {
      const smallFile = new File(["fake image content"], "test.jpg", { type: "image/jpeg" });
      const result = await optimizeImage(smallFile, { preset: "product" });

      expect(result).toHaveProperty("file");
      expect(result).toHaveProperty("originalSize");
      expect(result).toHaveProperty("optimizedSize");
      expect(result).toHaveProperty("compressionRatio");
      expect(result).toHaveProperty("format");
    });
  });
});
