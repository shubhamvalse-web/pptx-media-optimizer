/**
 * Controlled async processing queue.
 *
 * This queue is intentionally independent from the Image Optimizer.
 * The PPTX pipeline controls how many images are handed to the
 * optimizer at the same time.
 *
 * A failed image does NOT stop the rest of the queue.
 */

export async function processInBatches(
  items,
  processor,
  options = {}
) {
  const {
    concurrency = 2,
    onProgress = null,
  } = options;

  if (!Array.isArray(items)) {
    throw new Error("Queue items must be an array.");
  }

  if (typeof processor !== "function") {
    throw new Error("Queue processor must be a function.");
  }

  if (items.length === 0) {
    return [];
  }

  const workerCount = Math.max(
    1,
    Math.min(concurrency, items.length)
  );

  const results = new Array(items.length);

  let nextIndex = 0;
  let completed = 0;

  async function worker(workerId) {
    while (true) {
      const currentIndex = nextIndex++;

      if (currentIndex >= items.length) {
        return;
      }

      const item = items[currentIndex];

      const startedAt = performance.now();

      try {
        console.log(
          `[Queue Worker ${workerId}] Starting ${currentIndex + 1}/${items.length}:`,
          item.fileName
        );

        const result = await processor(item);

        const duration = performance.now() - startedAt;

        results[currentIndex] = {
          ...result,
          processingTimeMs: Math.round(duration),
        };

        console.log(
          `[Queue Worker ${workerId}] Completed ${currentIndex + 1}/${items.length}:`,
          {
            fileName: item.fileName,
            durationMs: Math.round(duration),
            success: result?.success !== false,
          }
        );
      } catch (error) {
        const duration = performance.now() - startedAt;

        console.error(
          `[Queue Worker ${workerId}] Failed ${currentIndex + 1}/${items.length}:`,
          item.fileName,
          error
        );

        results[currentIndex] = {
          success: false,
          fileName: item.fileName,
          originalSize: item.size || 0,
          optimizedSize: null,
          savings: 0,
          optimizedFormat: item.format
            ? `image/${item.format}`
            : null,
          error:
            error instanceof Error
              ? error.message
              : String(error),
          processingTimeMs: Math.round(duration),
        };
      }

      completed += 1;

      if (typeof onProgress === "function") {
        onProgress({
          completed,
          total: items.length,
          percentage:
            items.length > 0
              ? (completed / items.length) * 100
              : 100,
          currentItem: item,
          result: results[currentIndex],
        });
      }
    }
  }

  console.log(
    `Starting processing queue: ${items.length} items, ${workerCount} workers`
  );

  const workers = Array.from(
    { length: workerCount },
    (_, index) => worker(index + 1)
  );

  await Promise.all(workers);

  console.log(
    `Processing queue complete: ${completed}/${items.length}`
  );

  return results;
}