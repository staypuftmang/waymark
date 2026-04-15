const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Compress an uploaded image file: resize to max 1600px width (preserving
 * aspect ratio) and re-encode as JPEG at 0.85 quality. Returns a base64 data
 * URL. Falls back to the original uncompressed data URL if compression fails.
 */
export async function compressImage(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file);

  try {
    const img = await loadImage(originalDataUrl);

    let width = img.naturalWidth;
    let height = img.naturalHeight;

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    // White background in case source has transparency (PNG → JPEG)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const compressedDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

    // Sanity check: if compression failed or resulted in empty data, fall back
    if (!compressedDataUrl || compressedDataUrl.length < 100) {
      return originalDataUrl;
    }

    return compressedDataUrl;
  } catch {
    return originalDataUrl;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
