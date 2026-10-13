/**
 * Browser-only: turns a picked image file into a small JPEG data URL so we
 * never store or ship huge originals. Used for profile pictures (square
 * crop) and admin-uploaded backgrounds (kept landscape, capped in width).
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like an image."));
    };
    img.src = url;
  });
}

export async function resizeToSquareDataUrl(file: File, size = 320): Promise<string> {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export async function resizeToBackgroundDataUrl(file: File, maxWidth = 1000): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
