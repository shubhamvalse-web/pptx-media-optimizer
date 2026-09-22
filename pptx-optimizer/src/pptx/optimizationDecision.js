/**
 * Decides whether an image extracted from a PPTX
 * is worth sending to the image optimization engine.
 *
 * This layer does NOT modify the image.
 * It only analyses the image and returns a decision.
 */

// Images smaller than this are generally not worth processing.
// 10 KB is intentionally conservative.
const MIN_FILE_SIZE = 10 * 1024;

// Very small images usually don't provide meaningful savings.
const MIN_PIXEL_COUNT = 50_000;

// Images with a relatively high amount of data per pixel
// are more likely to benefit from optimization.
const BYTES_PER_PIXEL_THRESHOLD = 0.12;

/**
 * Analyse an image and determine whether optimization
 * should be attempted.
 *
 * @param {Object} image
 * @returns {Object}
 */
export function shouldAttemptOptimization(image) {
  const {
    size = 0,
    width = 0,
    height = 0,
    format = "",
  } = image;

  const pixelCount = width * height;

  const megapixels = pixelCount / 1_000_000;

  const bytesPerPixel =
    pixelCount > 0 ? size / pixelCount : 0;

  const reasons = [];

  // Unsupported formats should never reach the image optimizer.
  const supportedFormats = ["png", "jpg", "jpeg"];

  if (!supportedFormats.includes(format.toLowerCase())) {
    reasons.push("unsupported-format");
  }

  // Tiny files are unlikely to benefit enough to justify processing.
  if (size < MIN_FILE_SIZE) {
    reasons.push("file-too-small");
  }

  // Tiny images are unlikely to produce meaningful savings.
  if (pixelCount < MIN_PIXEL_COUNT) {
    reasons.push("image-too-small");
  }

  // Images carrying a relatively large number of bytes
  // per pixel are good candidates for optimization.
  if (bytesPerPixel > BYTES_PER_PIXEL_THRESHOLD) {
    reasons.push("high-bytes-per-pixel");
  }

  return {
    shouldOptimize:
      reasons.length === 0 ||
      reasons.includes("high-bytes-per-pixel"),

    reasons,

    metrics: {
      size,
      width,
      height,
      pixelCount,
      megapixels,
      bytesPerPixel,
    },
  };
}