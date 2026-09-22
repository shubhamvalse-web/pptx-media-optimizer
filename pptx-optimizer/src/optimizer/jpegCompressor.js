import { encode } from "@jsquash/jpeg";

export async function decodeImage(file) {
  const imageBitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const context = canvas.getContext("2d");
  context.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export async function encodeJPEG(imageData, quality, fileName) {
  const compressedBuffer = await encode(imageData, { quality });
  const compressedBlob = new Blob([compressedBuffer], { type: "image/jpeg" });
  return new File([compressedBlob], fileName, { type: "image/jpeg" });
}
