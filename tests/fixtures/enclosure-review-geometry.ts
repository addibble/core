import { mkdir } from "node:fs/promises"
import { basename, join } from "node:path"
import {
  booleans,
  geometries,
  measurements,
  modifiers,
  primitives,
  transforms,
} from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import type { Mat4, Vec3 } from "@jscad/modeling/src/maths/types"
import { Resvg } from "@resvg/resvg-js"
import type { CadComponent, CircuitJson } from "circuit-json"
import {
  convertCircuitJsonToGltf,
  convertSceneToGLTF,
  type Color,
  type Triangle,
} from "circuit-json-to-gltf"
import {
  createSceneFromGLTF,
  loadGLTFWithResourcesFromURL,
  renderGLTFToPNGFromGLB,
} from "poppygl"
import { resolvePoppyglOptions } from "./extend-expect-3d-matcher"

/** Exported glTF world geometry: right-handed, Y-up, mm; vertices are points.
 * The exporter's final glTF X is negated from its intermediate Scene3D X
 * (GLTFBuilder.toGltfTranslation); Y/Z correspond to Circuit JSON Z/Y.
 * No model placement is reconstructed: poppygl resolves exported node matrices.
 */
type ReviewPart = {
  sourceId?: CadComponent["source_component_id"]
  name: string
  solid: Geom3
  color: Color
}

const requireGlb = (output: ArrayBuffer | object): ArrayBuffer => {
  if (!(output instanceof ArrayBuffer)) {
    throw new Error("Enclosure diagnostic export did not produce a GLB")
  }
  return output
}

const exportGlb = async (circuitJson: CircuitJson) =>
  requireGlb(
    await convertCircuitJsonToGltf(circuitJson, {
      format: "glb",
      boardTextureResolution: 0,
      showBoundingBoxes: false,
    }),
  )

const readExportedSolids = async (glb: ArrayBuffer) => {
  const { gltf, resources } = await loadGLTFWithResourcesFromURL(
    `data:model/gltf-binary;base64,${Buffer.from(glb).toString("base64")}`,
  )
  const meshes = createSceneFromGLTF(gltf, resources)
    .drawCalls.filter((draw) => draw.mode === undefined || draw.mode === 4)
    .map((draw) => {
      const faces: Vec3[][] = []
      const count = draw.indices?.length ?? draw.positions.length / 3
      for (let index = 0; index < count; index += 3) {
        const face: Vec3[] = []
        for (let corner = 0; corner < 3; corner++) {
          const vertex = draw.indices?.[index + corner] ?? index + corner
          face.push([
            draw.positions[vertex * 3],
            draw.positions[vertex * 3 + 1],
            draw.positions[vertex * 3 + 2],
          ])
        }
        faces.push(face)
      }
      // Both libraries use column-major 4x4 matrices; only their TS container
      // types differ (Float32Array versus a fixed-length tuple).
      const matrix = Array.from(draw.model) as Mat4
      const solid = transforms.transform(
        matrix,
        geometries.geom3.fromPoints(faces),
      )
      const [r, g, b, a] = draw.material.baseColorFactor
      return { solid, color: [r * 255, g * 255, b * 255, a] as Color }
    })
  // A board's top, bottom and side materials are separate open draw calls.
  // Rejoin their polygons before CSG; unioning open surfaces is not a solid.
  const solid = geometries.geom3.create(
    meshes.flatMap((mesh) => geometries.geom3.toPolygons(mesh.solid)),
  )
  const volume = measurements.measureVolume(solid)
  if (!meshes.length || Math.abs(volume) < 1e-6) {
    throw new Error(
      `Expected a closed exported solid, received volume ${volume}`,
    )
  }
  // Exported double-sided board/OBJ surfaces may wind inward. CSG requires
  // outward winding; reversing faces changes no vertex or occupied volume.
  return [
    {
      solid: volume < 0 ? geometries.geom3.invert(solid) : solid,
      color: meshes[0].color,
    },
  ]
}

const toSceneMesh = (solid: Geom3) => {
  // modeling's barrel declares this CJS function as a module namespace.
  const generalize: unknown = modifiers.generalize
  if (typeof generalize !== "function") {
    throw new Error("JSCAD generalize must be a callable triangulator")
  }
  const triangulated: unknown = generalize({ triangulate: true }, solid)
  if (!geometries.geom3.isA(triangulated)) {
    throw new Error("JSCAD triangulation did not return a solid")
  }
  const triangles: Triangle[] = geometries.geom3
    .toPolygons(triangulated)
    .map((polygon) => {
      const [a, b, c] = polygon.vertices
      const plane = geometries.poly3.plane(polygon)
      return {
        vertices: [
          { x: a[0], y: a[1], z: a[2] },
          { x: b[0], y: b[1], z: b[2] },
          { x: c[0], y: c[1], z: c[2] },
        ],
        normal: {
          x: plane[0],
          y: plane[1],
          z: plane[2],
        },
      }
    })
  const [min, max] = measurements.measureBoundingBox(solid)
  return {
    triangles,
    boundingBox: {
      min: { x: min[0], y: min[1], z: min[2] },
      max: { x: max[0], y: max[1], z: max[2] },
    },
  }
}

/**
 * Persist unblessed diagnostics BEFORE correctness assertions.
 * `section` and camera are glTF-world points/lengths, right-handed Y-up mm.
 * Sectioning uses CSG on the exported triangles, never an interpreter of plans.
 */
export const writeEnclosureReviewGeometry = async ({
  circuitJson,
  testPath,
  section,
  caption,
  collision,
  evidence,
}: {
  circuitJson: CircuitJson
  testPath: string
  section: { center: Vec3; size: Vec3 }
  caption: string
  collision?: { first: string; second: string }
  evidence?: unknown
}) => {
  const directory = join(
    process.env.ENCLOSURE_REVIEW_ARTIFACT_DIR ??
      "debug-output/enclosure-review",
    basename(testPath).replace(/\.test\.tsx?$/, ""),
  )
  await mkdir(directory, { recursive: true })
  await Bun.write(
    join(directory, "emitted.circuit.json"),
    JSON.stringify(circuitJson, null, 2),
  )
  await Bun.write(join(directory, "emitted.glb"), await exportGlb(circuitJson))
  if (evidence !== undefined) {
    await Bun.write(
      join(directory, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    )
  }

  const parts: ReviewPart[] = []
  const cadComponents = circuitJson.filter(
    (element): element is CadComponent => element.type === "cad_component",
  )
  for (const cad of cadComponents) {
    const source = circuitJson.find(
      (element) =>
        element.type === "source_component" &&
        element.source_component_id === cad.source_component_id,
    )
    if (!source || source.type !== "source_component") {
      throw new Error(`Missing source owner for ${cad.cad_component_id}`)
    }
    const subset = circuitJson.filter(
      (element) =>
        element.type !== "pcb_board" &&
        (element.type !== "cad_component" || element === cad),
    )
    for (const mesh of await readExportedSolids(await exportGlb(subset))) {
      parts.push({
        ...mesh,
        sourceId: cad.source_component_id,
        name: source.name,
      })
    }
  }
  const boardOnly = circuitJson.filter(
    (element) => element.type !== "cad_component",
  )
  for (const mesh of await readExportedSolids(await exportGlb(boardOnly))) {
    parts.push({ ...mesh, name: "PCB" })
  }

  const solidNamed = (name: string) => {
    const solids = parts
      .filter((part) => part.name === name)
      .map((part) => part.solid)
    if (!solids.length) throw new Error(`No exported geometry for ${name}`)
    return booleans.union(...solids)
  }
  const overlap = collision
    ? booleans.intersect(
        solidNamed(collision.first),
        solidNamed(collision.second),
      )
    : undefined
  const clip = primitives.cuboid(section)
  const visibleParts = parts.map((part) => ({
    ...part,
    solid: booleans.intersect(
      clip,
      overlap ? booleans.subtract(part.solid, overlap) : part.solid,
    ),
  }))
  if (overlap) {
    visibleParts.push({
      name: "INTERSECTION",
      solid: booleans.intersect(clip, overlap),
      color: [255, 30, 30, 1],
    })
  }
  const sectionParts = visibleParts.filter(
    (part) => measurements.measureVolume(part.solid) > 1e-6,
  )
  const sectionGlb = requireGlb(
    await convertSceneToGLTF(
      {
        boxes: sectionParts.map((part) => ({
          center: { x: 0, y: 0, z: 0 },
          size: { x: 0, y: 0, z: 0 },
          // These vertices have already crossed GLTFBuilder's X reflection.
          // Return to its intermediate Scene3D frame before exporting again.
          mesh: toSceneMesh(transforms.mirrorX(part.solid)),
          color: part.color,
        })),
      },
      { binary: true },
    ),
  )
  await Bun.write(join(directory, "section.glb"), sectionGlb)
  const [roundTrip] = await readExportedSolids(sectionGlb)
  const expectedBounds = measurements.measureBoundingBox(
    geometries.geom3.create(
      sectionParts.flatMap((part) => geometries.geom3.toPolygons(part.solid)),
    ),
  )
  const renderedBounds = measurements.measureBoundingBox(roundTrip.solid)
  for (const end of [0, 1] as const) {
    for (const axis of [0, 1, 2] as const) {
      if (
        Math.abs(renderedBounds[end][axis] - expectedBounds[end][axis]) > 1e-4
      ) {
        throw new Error("Diagnostic section moved while re-exporting to glTF")
      }
    }
  }
  const [x, y, z] = section.center
  const png = await renderGLTFToPNGFromGLB(
    sectionGlb,
    await resolvePoppyglOptions(circuitJson, {
      camPos: [x, y, z + Math.max(section.size[0], section.size[1]) * 2],
      poppygl: {
        width: 960,
        height: 720,
        lookAt: [x, y, z],
        backgroundColor: [1, 1, 1],
        grid: false,
        ambient: 0.8,
        fov: 30,
      },
    }),
  )
  const escapedCaption = caption
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
  const captioned = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="800">
      <rect width="960" height="800" fill="white"/>
      <text x="24" y="28" font-family="sans-serif" font-size="20" fill="#a00">DIAGNOSTIC ONLY - not an accepted snapshot</text>
      <text x="24" y="58" font-family="sans-serif" font-size="18" fill="#222">${escapedCaption}</text>
      <image x="0" y="80" width="960" height="720" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>
    </svg>`,
  )
    .render()
    .asPng()
  await Bun.write(join(directory, "section.png"), captioned)
  const measuredEvidence = {
    frame: "glTF world, Y-up, mm",
    caption,
    parts: parts.map((part) => ({
      name: part.name,
      bounds: measurements.measureBoundingBox(part.solid),
      volumeMm3: measurements.measureVolume(part.solid),
    })),
    overlapMm3: overlap ? measurements.measureVolume(overlap) : undefined,
  }
  await Bun.write(
    join(directory, "measurements.json"),
    JSON.stringify(measuredEvidence, null, 2),
  )
  console.log(`Enclosure diagnostic (not a snapshot): ${directory}`)
  return { solidNamed, overlap, directory }
}
