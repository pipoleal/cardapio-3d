/**
 * Checagem leve no cliente (docs/PIPELINE-3D.md) — nunca bloqueia o envio,
 * só avisa: resolução mínima e nitidez (variância do Laplaciano, calculada
 * num canvas pequeno pra ser rápido, não no tamanho real da foto).
 */
export type PhotoQuality = { minResolutionOk: boolean; blurry: boolean; dark: boolean };

const SAMPLE_SIZE = 96;
const BLUR_VARIANCE_THRESHOLD = 50;
const DARK_BRIGHTNESS_THRESHOLD = 40;
const MIN_RESOLUTION_PX = 1024;

export async function checkPhotoQuality(file: Blob): Promise<PhotoQuality> {
  const bitmap = await createImageBitmap(file);
  const minResolutionOk = Math.min(bitmap.width, bitmap.height) >= MIN_RESOLUTION_PX;

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { minResolutionOk, blurry: false, dark: false };
  }
  ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const gray = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE);
  let brightnessSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const value = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    gray[i] = value;
    brightnessSum += value;
  }

  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;
  for (let y = 1; y < SAMPLE_SIZE - 1; y++) {
    for (let x = 1; x < SAMPLE_SIZE - 1; x++) {
      const idx = y * SAMPLE_SIZE + x;
      const laplacian =
        gray[idx - 1]! + gray[idx + 1]! + gray[idx - SAMPLE_SIZE]! + gray[idx + SAMPLE_SIZE]! - 4 * gray[idx]!;
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      count++;
    }
  }
  const mean = laplacianSum / count;
  const variance = laplacianSqSum / count - mean * mean;

  return {
    minResolutionOk,
    blurry: variance < BLUR_VARIANCE_THRESHOLD,
    dark: brightnessSum / gray.length < DARK_BRIGHTNESS_THRESHOLD,
  };
}
