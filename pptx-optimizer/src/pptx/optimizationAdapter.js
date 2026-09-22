/**
 * Optimization Adapter
 *
 * Bridge between the PPTX processing pipeline and the
 * existing Image Optimizer engine.
 */

export async function optimizePptxImage({
  zip,
  image,
  optimizer,
}) {
  if (!zip) {
    throw new Error("PPTX ZIP is required.");
  }

  if (!image) {
    throw new Error("Image metadata is required.");
  }

  if (typeof optimizer !== "function") {
    throw new Error("An image optimizer function is required.");
  }

  const startedAt = performance.now();

  console.log(
    "Preparing PPTX image for optimization:",
    image.fileName
  );

  // ---------------------------------------------------------
  // 1. Find image inside PPTX
  // ---------------------------------------------------------

  const imageEntry = zip.file(image.fileName);

  if (!imageEntry) {
    throw new Error(
      `Image not found inside PPTX: ${image.fileName}`
    );
  }

  // ---------------------------------------------------------
  // 2. Extract image
  // ---------------------------------------------------------

  const imageBlob = await imageEntry.async("blob");

  // ---------------------------------------------------------
  // 3. Convert PPTX asset to File
  // ---------------------------------------------------------

  const file = new File(
    [imageBlob],
    getFileName(image.fileName),
    {
      type: getMimeType(image.format),
    }
  );

  console.log("Image extracted from PPTX:", {
    fileName: file.name,
    type: file.type,
    size: file.size,
  });

  // ---------------------------------------------------------
  // 4. Send to existing Image Optimizer
  // ---------------------------------------------------------

  const result = await optimizer(file);

  // ---------------------------------------------------------
  // 5. Validate optimizer response
  // ---------------------------------------------------------

  if (!result) {
    throw new Error(
      `Image optimizer returned no result for ${file.name}`
    );
  }

  if (!result.optimizedFile) {
    throw new Error(
      `Image optimizer returned no optimized file for ${file.name}`
    );
  }

  // ---------------------------------------------------------
  // 6. Calculate result
  // ---------------------------------------------------------

  const optimizedSize = result.optimizedFile.size;

  const savings =
    result.savings ??
    calculateSavings(
      file.size,
      optimizedSize
    );

  const durationMs =
    Math.round(performance.now() - startedAt);

  return {
    success: true,

    fileName: image.fileName,

    originalFile: file,

    optimizedFile: result.optimizedFile,

    originalSize: file.size,

    optimizedSize,

    savings,

    optimizedFormat:
      result.optimizedFormat ??
      result.optimizedFile.type ??
      file.type,

    processingTimeMs: durationMs,
  };
}

/**
 * Convert PPTX media extension to MIME type.
 */
function getMimeType(format = "") {
  switch (format.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "png":
      return "image/png";

    case "webp":
      return "image/webp";

    default:
      return "application/octet-stream";
  }
}

/**
 * Extract filename from PPTX path.
 */
function getFileName(path) {
  return path.split("/").pop();
}

/**
 * Calculate percentage savings.
 */
function calculateSavings(
  originalSize,
  optimizedSize
) {
  if (
    !originalSize ||
    optimizedSize == null
  ) {
    return 0;
  }

  return (
    (1 - optimizedSize / originalSize) * 100
  );
}