import { optimizeImage } from "../optimizer/imageOptimizer.js";

export async function testOptimizer(file) {
  console.log("[Image Optimizer] Starting:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const result = await optimizeImage(file);

  console.log("[Image Optimizer] Complete:", {
    name: file.name,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savings: result.savings,
    optimizedFormat: result.optimizedFormat,
    shouldOptimize: result.shouldOptimize,
  });

  return result;
}