/**
 * Adapter between the PPTX optimizer and
 * the existing Image Optimization Engine.
 *
 * The PPTX pipeline should never need to know
 * how the image optimizer internally works.
 */

export async function optimizePptxImage(
  file,
  optimizeImageEngine
) {
  if (
    typeof optimizeImageEngine !==
    "function"
  ) {
    throw new Error(
      "No image optimization engine was provided."
    );
  }

  const result =
    await optimizeImageEngine(file);

  return {
    originalFile:
      result.originalFile,

    optimizedFile:
      result.optimizedFile,

    originalSize:
      result.originalSize,

    optimizedSize:
      result.optimizedSize,

    savings:
      result.savings,

    shouldOptimize:
      result.shouldOptimize,

    originalFormat:
      result.originalFormat,

    optimizedFormat:
      result.optimizedFormat,
  };
}