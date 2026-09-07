/**
 * Image Optimization Pipeline for ItChat Delivery
 * Standardized client-side optimization before uploading to Supabase Storage.
 */

export interface ImageOptimizationOptions {
  preset?: "product" | "banner" | "logo" | "avatar";
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  format?: "image/webp" | "image/jpeg" | "image/png" | "auto";
  maxInputSizeBytes?: number; // default 10MB
  preserveTransparency?: boolean;
}

export interface OptimizationResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number; // e.g. 0.85 (85% reduction)
  width: number;
  height: number;
  format: string;
}

const PRESETS: Record<string, { maxWidth: number; maxHeight: number; quality: number }> = {
  product: { maxWidth: 1600, maxHeight: 1600, quality: 0.80 },
  banner: { maxWidth: 1920, maxHeight: 1080, quality: 0.82 },
  logo: { maxWidth: 800, maxHeight: 800, quality: 0.80 },
  avatar: { maxWidth: 800, maxHeight: 800, quality: 0.80 },
};

/**
 * Calculates optimal target dimensions preserving aspect ratio without upscaling small images.
 */
export function calculateDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number
): { targetWidth: number; targetHeight: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { targetWidth: origWidth, targetHeight: origHeight };
  }

  const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
  // Never upscale smaller images
  if (ratio >= 1) {
    return { targetWidth: origWidth, targetHeight: origHeight };
  }

  return {
    targetWidth: Math.round(origWidth * ratio),
    targetHeight: Math.round(origHeight * ratio),
  };
}

/**
 * Loads an image File into an HTMLImageElement or ImageBitmap.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Converts a Canvas element to a Blob.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      format,
      quality
    );
  });
}

/**
 * Checks if a PNG image contains transparent pixels.
 */
function checkTransparency(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement("canvas");
    // Sample at smaller resolution for speed
    const sampleWidth = Math.min(img.width, 200);
    const sampleHeight = Math.min(img.height, 200);
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
    const data = imgData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Main Image Optimization Function
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> {
  const maxInputSizeBytes = options.maxInputSizeBytes ?? 10 * 1024 * 1024; // 10MB
  if (file.size > maxInputSizeBytes) {
    const maxMb = (maxInputSizeBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`Imagem excede o tamanho máximo permitido de ${maxMb}MB`);
  }

  const presetConfig = options.preset ? PRESETS[options.preset] ?? PRESETS.product : PRESETS.product;
  const maxWidth = options.maxWidth ?? presetConfig.maxWidth;
  const maxHeight = options.maxHeight ?? presetConfig.maxHeight;
  const quality = options.quality ?? presetConfig.quality;
  const targetFormat = options.format ?? "auto";

  // Fallback for non-browser/non-canvas environments
  if (typeof window === "undefined" || typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") {
    return {
      file,
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 0,
      width: 0,
      height: 0,
      format: file.type || "image/jpeg",
    };
  }

  try {
    const img = await loadImage(file);
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    const { targetWidth, targetHeight } = calculateDimensions(origWidth, origHeight, maxWidth, maxHeight);

    let finalFormat = targetFormat === "auto" ? "image/webp" : targetFormat;

    // Handle PNG transparency
    if (file.type === "image/png" && (options.preserveTransparency ?? true)) {
      if (checkTransparency(img)) {
        finalFormat = "image/png";
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Não foi possível criar o contexto visual 2D");
    }

    // Draw image onto canvas (Canvas flattens metadata & strips EXIF)
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let blob = await canvasToBlob(canvas, finalFormat, quality);

    // Fallback if WebP canvas export is unsupported in client browser
    if (!blob && finalFormat === "image/webp") {
      finalFormat = "image/jpeg";
      blob = await canvasToBlob(canvas, finalFormat, quality);
    }

    if (!blob) {
      throw new Error("Erro ao gerar Blob da imagem otimizada");
    }

    // Determine target extension
    const ext = finalFormat === "image/webp" ? "webp" : finalFormat === "image/png" ? "png" : "jpg";
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const newFileName = `${nameWithoutExt}.${ext}`;

    const optimizedFile = new File([blob], newFileName, { type: finalFormat });

    // Use optimized file if it reduced size, or if format was explicitly requested
    const resultFile = (optimizedFile.size < file.size || targetFormat !== "auto") ? optimizedFile : file;

    const originalSize = file.size;
    const optimizedSize = resultFile.size;
    const compressionRatio = originalSize > 0 ? Math.max(0, 1 - optimizedSize / originalSize) : 0;

    return {
      file: resultFile,
      originalSize,
      optimizedSize,
      compressionRatio,
      width: targetWidth,
      height: targetHeight,
      format: resultFile.type,
    };
  } catch (error) {
    // If canvas operation fails, fallback safely to original file
    return {
      file,
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 0,
      width: 0,
      height: 0,
      format: file.type || "image/jpeg",
    };
  }
}
