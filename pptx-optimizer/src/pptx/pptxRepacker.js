// src/pptx/pptxRepacker.js

/**
 * Repack a PPTX ZIP with optimized media.
 *
 * The original PPTX ZIP is reused.
 * Only image entries that have a smaller optimizedFile are replaced.
 *
 * @param {JSZip} zip
 * @param {Array} optimizationResults
 * @param {Object} options
 * @returns {Promise<File>}
 */
export async function repackPptx(
  zip,
  optimizationResults = [],
  options = {}
) {
  if (!zip) {
    throw new Error("No PPTX ZIP was provided.");
  }

  if (!Array.isArray(optimizationResults)) {
    throw new Error("Optimization results must be an array.");
  }

  const {
    onProgress = null,
    originalFileName = "presentation.pptx",
  } = options;

  console.log("========================================");
  console.log("STARTING PPTX REPACK");
  console.log("========================================");

  console.log(
    "Optimization results received:",
    optimizationResults.length
  );

  let replacedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  /*
   * ---------------------------------------------------------
   * REPLACE OPTIMIZED MEDIA
   * ---------------------------------------------------------
   */

  for (let index = 0; index < optimizationResults.length; index++) {
    const result = optimizationResults[index];

    try {
      /*
       * We expect the decoder/optimization pipeline to give us
       * the original PPTX media path, for example:
       *
       * ppt/media/image-1-7.png
       */

      const mediaPath =
        result?.fileName ||
        result?.path ||
        result?.mediaPath;

      if (!mediaPath) {
        console.warn(
          "Skipping optimization result without media path:",
          result
        );

        unchangedCount++;
        continue;
      }

      /*
       * -------------------------------------------------------
       * Only replace files where optimization succeeded.
       * -------------------------------------------------------
       */

      const optimizedFile = result?.optimizedFile;

      if (!(optimizedFile instanceof Blob)) {
        console.warn(
          `No optimized file available for ${mediaPath}`
        );

        unchangedCount++;
        continue;
      }

      const originalSize =
        Number(result?.originalSize) ||
        Number(result?.originalFile?.size) ||
        0;

      const optimizedSize =
        Number(result?.optimizedSize) ||
        Number(optimizedFile.size) ||
        0;

      /*
       * Safety rule:
       *
       * NEVER replace the original if the optimized file
       * isn't actually smaller.
       */

      if (
        originalSize > 0 &&
        optimizedSize >= originalSize
      ) {
        console.log(
          `Keeping original: ${mediaPath}`,
          {
            originalSize,
            optimizedSize,
          }
        );

        unchangedCount++;
        continue;
      }

      /*
       * Confirm that the file actually exists in the PPTX.
       */

      const existingEntry = zip.file(mediaPath);

      if (!existingEntry) {
        console.warn(
          `PPTX media entry not found: ${mediaPath}`
        );

        unchangedCount++;
        continue;
      }

      /*
       * JSZip accepts Blob directly.
       *
       * This replaces the existing ppt/media entry while
       * preserving the rest of the PPTX structure.
       */

      zip.file(mediaPath, optimizedFile);

      replacedCount++;

      console.log(
        `Replaced: ${mediaPath}`,
        {
          originalSize,
          optimizedSize,
          savings:
            originalSize > 0
              ? `${(
                  ((originalSize - optimizedSize) /
                    originalSize) *
                  100
                ).toFixed(1)}%`
              : "unknown",
        }
      );
    } catch (error) {
      failedCount++;

      console.error(
        `Failed to repack ${result?.fileName}:`,
        error
      );
    }

    /*
     * Report repacking progress.
     */

    if (typeof onProgress === "function") {
      onProgress({
        completed: index + 1,
        total: optimizationResults.length,
        percentage:
          ((index + 1) /
            optimizationResults.length) *
          100,
      });
    }
  }

  console.log("----------------------------------------");
  console.log("MEDIA REPLACEMENT COMPLETE");
  console.log("Replaced:", replacedCount);
  console.log("Unchanged:", unchangedCount);
  console.log("Failed:", failedCount);
  console.log("----------------------------------------");

  /*
   * ---------------------------------------------------------
   * GENERATE NEW PPTX
   * ---------------------------------------------------------
   */

  console.log("Generating optimized PPTX...");

  const blob = await zip.generateAsync(
    {
      type: "blob",

      /*
       * PPTX is a ZIP container.
       *
       * DEFLATE ensures the rebuilt archive is properly
       * compressed instead of unnecessarily growing.
       */
      compression: "DEFLATE",

      compressionOptions: {
        level: 6,
      },

      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },

    (metadata) => {
      if (typeof onProgress === "function") {
        onProgress({
          stage: "repacking",
          completed: metadata.percent,
          total: 100,
          percentage: metadata.percent,
          currentFile:
            metadata.currentFile || null,
        });
      }
    }
  );

  /*
   * ---------------------------------------------------------
   * CREATE DOWNLOADABLE FILE
   * ---------------------------------------------------------
   */

  const safeOriginalName =
    originalFileName
      .replace(/\.pptx$/i, "")
      .trim() || "presentation";

  const outputFileName =
    `${safeOriginalName}_optimized.pptx`;

  const optimizedFile = new File(
    [blob],
    outputFileName,
    {
      type:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
  );

  console.log("========================================");
  console.log("PPTX REPACK COMPLETE");
  console.log("Output:", outputFileName);
  console.log("Size:", optimizedFile.size);
  console.log("Replaced:", replacedCount);
  console.log("Unchanged:", unchangedCount);
  console.log("Failed:", failedCount);
  console.log("========================================");

  return optimizedFile;
}


/**
 * Download a repacked PPTX.
 *
 * @param {File|Blob} file
 */
export function downloadPptx(file) {
  if (!file) {
    throw new Error(
      "No optimized PPTX file is available for download."
    );
  }

  const blob =
    file instanceof Blob
      ? file
      : new Blob([file], {
          type:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });

  const url = URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;

  anchor.download =
    file.name ||
    "presentation_optimized.pptx";

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  /*
   * Give the browser a moment to start the download
   * before releasing the object URL.
   */

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  console.log(
    "PPTX download triggered:",
    anchor.download
  );
}