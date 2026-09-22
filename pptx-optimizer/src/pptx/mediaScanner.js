import { processInBatches } from "./processingQueue";

const IMAGE_PATTERN =
  /\.(jpg|jpeg|png|webp)$/i;

const VIDEO_PATTERN =
  /\.(mp4|mov|webm)$/i;

function getImageDimensions(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(
        new Error("Unable to decode image")
      );
    };

    image.src = imageUrl;
  });
}

function analyzeImage(
  fileName,
  fileSize,
  width,
  height
) {
  const pixelCount = width * height;

  const megapixels =
    pixelCount / 1_000_000;

  const bytesPerPixel =
    pixelCount > 0
      ? fileSize / pixelCount
      : 0;

  const format =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase() || "";

  return {
    fileName,
    format,
    size: fileSize,
    width,
    height,
    pixelCount,
    megapixels,
    bytesPerPixel,
  };
}

async function analyzeOneImage(
  zip,
  fileName
) {
  const fileData =
    await zip.files[fileName].async(
      "uint8array"
    );

  const blob = new Blob([fileData]);

  const imageUrl =
    URL.createObjectURL(blob);

  try {
    const dimensions =
      await getImageDimensions(imageUrl);

    return {
      success: true,
      ...analyzeImage(
        fileName,
        fileData.byteLength,
        dimensions.width,
        dimensions.height
      ),
    };
  } catch (error) {
    return {
      success: false,
      fileName,
      size: fileData.byteLength,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function scanMedia(zip) {
  const mediaFiles = Object.keys(
    zip.files
  ).filter(
    (fileName) =>
      fileName.startsWith("ppt/media/") &&
      !zip.files[fileName].dir
  );

  const imageFiles =
    mediaFiles.filter((fileName) =>
      IMAGE_PATTERN.test(fileName)
    );

  const videoFiles =
    mediaFiles.filter((fileName) =>
      VIDEO_PATTERN.test(fileName)
    );

  const otherFiles =
    mediaFiles.filter(
      (fileName) =>
        !imageFiles.includes(fileName) &&
        !videoFiles.includes(fileName)
    );

  console.log(
    "Starting controlled image analysis..."
  );

  const analysisResults =
    await processInBatches(
      imageFiles,
      (fileName) =>
        analyzeOneImage(zip, fileName),
      4
    );

  const imageDetails =
    analysisResults.filter(
      (result) => result.success
    );

  const failedImages =
    analysisResults.filter(
      (result) => !result.success
    );

  const totalImageBytes =
    imageDetails.reduce(
      (total, image) =>
        total + image.size,
      0
    );

  const totalPixelCount =
    imageDetails.reduce(
      (total, image) =>
        total + image.pixelCount,
      0
    );

  const summary = {
    imageCount: imageDetails.length,

    totalImageBytes,

    totalImageMB:
      totalImageBytes /
      (1024 * 1024),

    totalPixelCount,

    totalMegapixels:
      totalPixelCount /
      1_000_000,

    failedImageCount:
      failedImages.length,
  };

  console.log(
    "Controlled image analysis complete!"
  );

  console.log(
    "Successfully analyzed:",
    imageDetails.length
  );

  if (failedImages.length > 0) {
    console.warn(
      "Images that could not be analyzed:",
      failedImages
    );
  }

  return {
    mediaFiles,
    imageFiles,
    videoFiles,
    otherFiles,

    imageDetails,

    failedImages,

    summary,
  };
}