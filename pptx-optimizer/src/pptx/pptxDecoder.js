import JSZip from "jszip";

import { scanMedia } from "./mediaScanner";
import { shouldAttemptOptimization } from "./optimizationDecision";
import { optimizePptxImage } from "./optimizationAdapter";
import { testOptimizer } from "./testOptimizer";
import { processInBatches } from "./processingQueue";

/**
 * =========================================================
 * OPTIMIZATION CONFIGURATION
 * =========================================================
 *
 * Keep this conservative because each image optimization
 * can internally use WASM + Web Workers.
 *
 * The queue controls how many PPTX images are processed
 * simultaneously.
 */
const OPTIMIZATION_CONCURRENCY = 2;

/**
 * =========================================================
 * DECODE + PROCESS PPTX
 * =========================================================
 *
 * Pipeline:
 *
 * PPTX
 *   ↓
 * JSZip
 *   ↓
 * Media Scanner
 *   ↓
 * Image Analysis
 *   ↓
 * Optimization Decisions
 *   ↓
 * Candidate Queue
 *   ↓
 * Existing Image Optimizer
 *   ↓
 * Results
 *
 * @param {File} file
 * @param {Object} options
 * @param {Function} options.onProgress
 * @param {Function} options.onStageChange
 */
export async function decodePptx(
  file,
  {
    onProgress = null,
    onStageChange = null,
  } = {}
) {
  console.log("Opening PPTX:", file.name);

  // =========================================================
  // 1. OPEN PPTX
  // =========================================================

  onStageChange?.({
    stage: "opening",
    message: "Opening presentation...",
  });

  const arrayBuffer =
    await file.arrayBuffer();

  const zip =
    await JSZip.loadAsync(arrayBuffer);

  console.log("PPTX opened successfully!");

  // =========================================================
  // 2. SCAN MEDIA
  // =========================================================

  onStageChange?.({
    stage: "scanning",
    message: "Scanning presentation media...",
  });

  const mediaResult =
    await scanMedia(zip);

  console.log(
    "Media scanner result:",
    mediaResult
  );

  // =========================================================
  // 3. EXTRACT SCANNER ARRAYS
  // =========================================================

  const mediaFiles =
    mediaResult.mediaFiles || [];

  const imageFiles =
    mediaResult.imageFiles || [];

  const videoFiles =
    mediaResult.videoFiles || [];

  const otherFiles =
    mediaResult.otherFiles || [];

  const imageDetails =
    mediaResult.imageDetails || [];

  console.log(
    "Total media files:",
    mediaFiles.length
  );

  console.log(
    "Image files:",
    imageFiles.length
  );

  console.log(
    "Video files:",
    videoFiles.length
  );

  console.log(
    "Other media files:",
    otherFiles
  );

  // =========================================================
  // 4. IMAGE ANALYSIS SUMMARY
  // =========================================================

  const totalImageBytes =
    imageDetails.reduce(
      (total, image) =>
        total + (image.size || 0),
      0
    );

  const totalPixelCount =
    imageDetails.reduce(
      (total, image) =>
        total +
        (image.width || 0) *
          (image.height || 0),
      0
    );

  const totalMegapixels =
    totalPixelCount / 1_000_000;

  const totalImageMB =
    totalImageBytes /
    (1024 * 1024);

  const imageAnalysisSummary = {
    imageCount:
      imageDetails.length,

    totalImageBytes,

    totalImageMB,

    totalPixelCount,

    totalMegapixels,
  };

  console.log(
    "Image analysis summary:",
    imageAnalysisSummary
  );

  // =========================================================
  // 5. OPTIMIZATION DECISIONS
  // =========================================================

  onStageChange?.({
    stage: "deciding",
    message:
      "Determining which images need optimization...",
  });

  const optimizationDecisions =
    imageDetails.map((image) => {
      const decision =
        shouldAttemptOptimization(image);

      return {
        ...image,
        decision,
      };
    });

  const candidates =
    optimizationDecisions.filter(
      (image) =>
        image.decision?.shouldOptimize === true
    );

  console.log(
    "Optimization decisions:",
    optimizationDecisions
  );

  console.log(
    "Optimization candidates:",
    candidates.length
  );

  // =========================================================
  // 6. NO CANDIDATES
  // =========================================================

  if (candidates.length === 0) {
    console.log(
      "No images passed the optimization decision layer."
    );

    onProgress?.({
      completed: 0,
      total: 0,
      percentage: 100,
    });

    onStageChange?.({
      stage: "complete",
      message:
        "No images require optimization.",
      total: 0,
      completed: 0,
      percentage: 100,
    });

    return {
      zip,

      mediaFiles,

      imageFiles,

      videoFiles,

      otherFiles,

      imageDetails,

      imageAnalysisSummary,

      optimizationDecisions,

      candidates,

      optimizationResults: [],

      optimizationSummary:
        createOptimizationSummary([]),
    };
  }

  // =========================================================
  // 7. START OPTIMIZATION QUEUE
  // =========================================================

  onStageChange?.({
    stage: "optimizing",

    message:
      `Optimizing ${candidates.length} images...`,

    total:
      candidates.length,

    completed: 0,

    percentage: 0,
  });

  onProgress?.({
    completed: 0,

    total:
      candidates.length,

    percentage: 0,

    fileName: null,

    result: null,
  });

  console.log(
    `Starting optimization queue: ${candidates.length} candidates`
  );

  // =========================================================
  // 8. PROCESS CANDIDATES
  // =========================================================

  const optimizationResults =
    await processInBatches(
      candidates,

      async (candidate) => {
        console.log(
          "Optimizing PPTX image:",
          candidate.fileName
        );

        try {
          const result =
            await optimizePptxImage({
              zip,

              image: candidate,

              optimizer:
                testOptimizer,
            });

          console.log(
            "Optimization successful:",
            {
              fileName:
                candidate.fileName,

              originalSize:
                result.originalSize,

              optimizedSize:
                result.optimizedSize,

              savings:
                result.savings,

              processingTimeMs:
                result.processingTimeMs,

              optimizedFormat:
                result.optimizedFormat,
            }
          );

          return result;
        } catch (error) {
          console.error(
            `Optimization failed for ${candidate.fileName}:`,
            error
          );

          return {
            success: false,

            fileName:
              candidate.fileName,

            originalSize:
              candidate.size || 0,

            optimizedSize: null,

            savings: 0,

            optimizedFormat:
              candidate.format
                ? `image/${candidate.format}`
                : null,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          };
        }
      },

      {
        concurrency:
          OPTIMIZATION_CONCURRENCY,

        onProgress: ({
          completed,
          total,
          percentage,
          currentItem,
          result,
        }) => {
          const safePercentage =
            Number(
              Number(percentage).toFixed(1)
            );

          console.log(
            `[Optimization Progress] ${completed}/${total}`,
            {
              percentage:
                safePercentage,

              fileName:
                currentItem?.fileName,

              success:
                result?.success,

              savings:
                result?.savings,

              processingTimeMs:
                result?.processingTimeMs,
            }
          );

          // -----------------------------------------------
          // Send progress to React UI
          // -----------------------------------------------

          onProgress?.({
            completed,

            total,

            percentage:
              safePercentage,

            fileName:
              currentItem?.fileName || null,

            result:
              result || null,
          });

          // -----------------------------------------------
          // Also update stage information
          // -----------------------------------------------

          onStageChange?.({
            stage: "optimizing",

            message:
              `Optimizing ${completed} of ${total} images...`,

            total,

            completed,

            percentage:
              safePercentage,

            fileName:
              currentItem?.fileName || null,

            result:
              result || null,
          });
        },
      }
    );

  // =========================================================
  // 9. CREATE SUMMARY
  // =========================================================

  const optimizationSummary =
    createOptimizationSummary(
      optimizationResults
    );

  console.log(
    "Optimization complete:",
    optimizationSummary
  );

  // =========================================================
  // 10. FINAL PROGRESS
  // =========================================================

  onProgress?.({
    completed:
      candidates.length,

    total:
      candidates.length,

    percentage: 100,

    fileName: null,

    result: null,
  });

  onStageChange?.({
    stage: "complete",

    message:
      "Image optimization complete.",

    total:
      candidates.length,

    completed:
      candidates.length,

    percentage: 100,

    summary:
      optimizationSummary,
  });

  // =========================================================
  // 11. RETURN EVERYTHING
  // =========================================================

  return {
    zip,

    mediaFiles,

    imageFiles,

    videoFiles,

    otherFiles,

    imageDetails,

    imageAnalysisSummary,

    optimizationDecisions,

    candidates,

    optimizationResults,

    optimizationSummary,
  };
}

/**
 * =========================================================
 * CREATE OPTIMIZATION SUMMARY
 * =========================================================
 *
 * Creates aggregate statistics from all optimization
 * results.
 */
function createOptimizationSummary(
  results
) {
  const successfulResults =
    results.filter(
      (result) =>
        result.success
    );

  const failedResults =
    results.filter(
      (result) =>
        !result.success
    );

  const improvedResults =
    successfulResults.filter(
      (result) =>
        result.optimizedSize != null &&
        result.optimizedSize <
          result.originalSize
    );

  const unchangedResults =
    successfulResults.filter(
      (result) =>
        result.optimizedSize != null &&
        result.optimizedSize >=
          result.originalSize
    );

  /*
   * Calculate totals across ALL successful
   * candidates, not only improved images.
   *
   * This gives us a complete picture of the
   * optimization workload.
   */

  const originalBytes =
    successfulResults.reduce(
      (total, result) =>
        total +
        (result.originalSize || 0),
      0
    );

  const optimizedBytes =
    successfulResults.reduce(
      (total, result) =>
        total +
        (result.optimizedSize || 0),
      0
    );

  const bytesSaved =
    originalBytes -
    optimizedBytes;

  const savingsPercentage =
    originalBytes > 0
      ? (bytesSaved /
          originalBytes) *
        100
      : 0;

  const totalProcessingTimeMs =
    results.reduce(
      (total, result) =>
        total +
        (result.processingTimeMs || 0),
      0
    );

  return {
    candidates:
      results.length,

    successful:
      successfulResults.length,

    failed:
      failedResults.length,

    improved:
      improvedResults.length,

    unchanged:
      unchangedResults.length,

    originalBytes,

    optimizedBytes,

    bytesSaved,

    savingsPercentage,

    totalProcessingTimeMs,
  };
}