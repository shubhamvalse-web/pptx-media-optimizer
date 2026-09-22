const POOL_SIZE = Math.min(
  (typeof navigator !== "undefined" &&
    navigator.hardwareConcurrency) ||
    4,
  6
);

let pool = null;
let nextTaskId = 0;

function createWorker(poolState) {
  const worker = new Worker(
    new URL("./imageOptimizer.worker.js", import.meta.url),
    {
      type: "module",
    }
  );

  const workerEntry = {
    worker,
    busy: false,
  };

  worker.onmessage = (event) => {
    handleMessage(poolState, workerEntry, event);
  };

  worker.onerror = (error) => {
    handleWorkerError(poolState, workerEntry, error);
  };

  return workerEntry;
}

function createPool() {
  const poolState = {
    workers: [],
    queue: [],
    pending: new Map(),
  };

  for (let i = 0; i < POOL_SIZE; i++) {
    poolState.workers.push(
      createWorker(poolState)
    );
  }

  return poolState;
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

function handleMessage(
  poolState,
  workerEntry,
  event
) {
  const {
    taskId,
    success,
    optimizedFile,
    optimizedFormat,
    error,
  } = event.data;

  const entry =
    poolState.pending.get(taskId);

  if (!entry) {
    return;
  }

  poolState.pending.delete(taskId);

  workerEntry.busy = false;

  if (success) {
    entry.resolve({
      optimizedFile,
      optimizedFormat,
    });
  } else {
    entry.reject(
      new Error(
        error ||
          "Image optimization failed"
      )
    );
  }

  dispatch(poolState);
}

function handleWorkerError(
  poolState,
  workerEntry,
  error
) {
  console.error(
    "=== IMAGE OPTIMIZER WORKER FAILED ===",
    error
  );

  // Find every task assigned to this worker.
  for (const [
    taskId,
    entry,
  ] of poolState.pending.entries()) {
    if (
      entry.workerEntry === workerEntry
    ) {
      poolState.pending.delete(taskId);

      entry.reject(
        new Error(
          "Image optimizer worker failed"
        )
      );
    }
  }

  // Remove dead worker.
  const index =
    poolState.workers.indexOf(
      workerEntry
    );

  if (index !== -1) {
    poolState.workers.splice(
      index,
      1
    );
  }

  try {
    workerEntry.worker.terminate();
  } catch {
    // Ignore termination errors.
  }

  // Replace the failed worker.
  const replacement =
    createWorker(poolState);

  poolState.workers.push(
    replacement
  );

  dispatch(poolState);
}

function dispatch(poolState) {
  for (const workerEntry of poolState.workers) {
    if (workerEntry.busy) {
      continue;
    }

    if (
      poolState.queue.length === 0
    ) {
      break;
    }

    const task =
      poolState.queue.shift();

    workerEntry.busy = true;

    poolState.pending.set(
      task.taskId,
      {
        ...task,
        workerEntry,
      }
    );

    workerEntry.worker.postMessage({
      file: task.file,
      type: task.file.type,
      taskId: task.taskId,
    });
  }
}

export function optimizeImage(file) {
  const poolState = getPool();

  return new Promise(
    (resolve, reject) => {
      const taskId =
        nextTaskId++;

      poolState.queue.push({
        taskId,
        file,
        resolve,
        reject,
      });

      dispatch(poolState);
    }
  ).then(
    ({
      optimizedFile,
      optimizedFormat,
    }) => {
      const originalSize =
        file.size;

      const optimizedSize =
        optimizedFile.size;

      const savings =
        (1 -
          optimizedSize /
            originalSize) *
        100;

      const shouldOptimize =
        savings >= 5;

      return {
        originalFile: file,
        optimizedFile,
        originalSize,
        optimizedSize,
        savings,
        shouldOptimize,
        originalFormat:
          file.type,
        optimizedFormat,
      };
    }
  );
}