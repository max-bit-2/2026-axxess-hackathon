import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

const compositionId = "MedivanceDemo";

async function main() {
  console.log("Bundling...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve("./remotion/index.ts"),
    // Webpack override to handle any alias issues
    webpackOverride: (config) => config,
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
  });

  console.log(`Rendering ${composition.id} (${composition.durationInFrames} frames @ ${composition.fps}fps)...`);

  const outputLocation = path.resolve("./public/demo-video.mp4");

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
  });

  console.log(`Done! Video saved to ${outputLocation}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
