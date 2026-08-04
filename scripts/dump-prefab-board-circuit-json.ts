/**
 * Render the prefab-board enclosure fixture and write its Circuit JSON to disk.
 *
 * The 3d-viewer story consumes the output as a static asset rather than importing
 * core, because 3d-viewer sits below core in the dependency order. Run this in
 * watch mode while tweaking the board and the viewer picks the change up over
 * Vite HMR:
 *
 *   bun run watch:prefab-board
 *
 * A full render is ~500ms, so the edit-to-pixels loop stays under a second.
 */
import { renderPrefabBoardCircuitJson } from "../tests/enclosure/prefab-board/render-prefab-board"

const DEFAULT_OUT =
  "../3d-viewer/stories/assets/prefab-board-with-enclosure.json"

const outPath = process.argv[2] ?? DEFAULT_OUT

const started = performance.now()
const circuitJson = await renderPrefabBoardCircuitJson()
const elapsed = Math.round(performance.now() - started)

await Bun.write(outPath, JSON.stringify(circuitJson))

const count = (type: string) =>
  (circuitJson as Array<{ type: string }>).filter((e) => e.type === type).length

const apertureFaces = (circuitJson as any[]).filter(
  (e) => e.type === "source_cutout_aperture",
).length

console.log(
  [
    `rendered in ${elapsed}ms -> ${outPath}`,
    `  ${circuitJson.length} elements`,
    `  ${count("cad_component")} cad_component`,
    `  ${count("cad_fdm_enclosure")} cad_fdm_enclosure`,
    `  ${apertureFaces} source_cutout_aperture`,
  ].join("\n"),
)
