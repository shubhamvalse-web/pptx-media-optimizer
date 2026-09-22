const worker = new Worker(
  new URL(
    "../../../Web Image Compression tool/image-optimizer/src/imageOptimizer.worker.js",
    import.meta.url
  ),
  { type: "module" }
);

worker.onmessage = (event) => {
  console.log("WORKER TEST MESSAGE:", event.data);
};

worker.onerror = (event) => {
  console.error("=== DIRECT WORKER TEST FAILED ===");
  console.error(event);
  console.error("message:", event.message);
  console.error("filename:", event.filename);
  console.error("lineno:", event.lineno);
  console.error("colno:", event.colno);
};

console.log("Direct worker created:", worker);