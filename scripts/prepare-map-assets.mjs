import { readdir, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
const source = join(process.cwd(), "node_modules", "maplibre-gl", "dist");
const target = join(process.cwd(), "public", "maplibre");
await mkdir(target, { recursive: true });
for (const file of await readdir(source)) {
  if (file.endsWith(".mjs") && !file.includes("-dev"))
    await copyFile(join(source, file), join(target, file));
}
console.log("Prepared same-origin MapLibre module workers.");
