import { optimise } from "@jsquash/oxipng";

export async function compressPNG(file) {
  try {
    const imageBuffer = await file.arrayBuffer();

    const optimizedBuffer = await optimise(imageBuffer, {
      level: 3,
      optimiseAlpha: false,
    });

    return new File(
      [optimizedBuffer],
      file.name,
      {
        type: "image/png",
      }
    );
  } catch (error) {
    console.warn(
      "[PNG Compressor] PNG optimization failed:",
      file.name,
      error
    );

    // Important:
    // A PNG that oxipng cannot process should not
    // break the entire optimization pipeline.
    return null;
  }
}