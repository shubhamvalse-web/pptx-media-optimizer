import { decodeImage, encodeJPEG } from "./jpegCompressor";
import { compressPNG } from "./pngCompressor";

console.log("[Image Optimizer Worker] Started");

function hasTransparency(imageData) {
  const { data } = imageData;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      return true;
    }
  }

  return false;
}

function toJpegName(fileName) {
  return fileName.replace(/\.[^.]+$/, "") + ".jpg";
}

self.onmessage = async (event) => {
  const { file, type, taskId } = event.data;

  console.log("[Image Optimizer Worker] Processing:", {
    taskId,
    name: file?.name,
    type,
    size: file?.size,
  });

  try {
    let optimizedFile = null;

    // --------------------------------------------------
    // JPEG
    // --------------------------------------------------

    if (type === "image/jpeg") {
      const imageData = await decodeImage(file);

      const candidates = await Promise.all(
        [90, 85, 80, 75].map((quality) =>
          encodeJPEG(imageData, quality, file.name)
        )
      );

      optimizedFile = candidates.reduce((smallest, candidate) =>
        candidate.size < smallest.size
          ? candidate
          : smallest
      );
    }

    // --------------------------------------------------
    // PNG
    // --------------------------------------------------

    else if (type === "image/png") {
      const imageData = await decodeImage(file);

      const candidates = [];

      // Try lossless PNG optimization.
      const pngResult = await compressPNG(file);

      if (pngResult) {
        candidates.push(pngResult);
      }

      // Only try JPEG conversion if the image has
      // no transparency.
      if (!hasTransparency(imageData)) {
        const jpegCandidates = await Promise.all(
          [85, 80, 75].map((quality) =>
            encodeJPEG(
              imageData,
              quality,
              toJpegName(file.name)
            )
          )
        );

        candidates.push(...jpegCandidates);
      }

      // If every optimization attempt failed,
      // simply return the original file.
      if (candidates.length === 0) {
        console.warn(
          "[Image Optimizer Worker] No optimization candidate:",
          file.name
        );

        optimizedFile = file;
      } else {
        optimizedFile = candidates.reduce(
          (smallest, candidate) =>
            candidate.size < smallest.size
              ? candidate
              : smallest
        );
      }
    }

    // --------------------------------------------------
    // Unsupported format
    // --------------------------------------------------

    else {
      throw new Error(
        `Unsupported image format: ${type}`
      );
    }

    console.log(
      "[Image Optimizer Worker] Complete:",
      {
        taskId,
        name: file.name,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        format: optimizedFile.type,
      }
    );

    self.postMessage({
      taskId,
      success: true,
      optimizedFile,
      optimizedFormat: optimizedFile.type,
    });

  } catch (error) {
    console.error(
      "[Image Optimizer Worker] Failed:",
      {
        taskId,
        fileName: file?.name,
        error,
      }
    );

    self.postMessage({
      taskId,
      success: false,
      error:
        error?.message ||
        "Unknown image optimization error",
      stack: error?.stack || null,
    });
  }
};