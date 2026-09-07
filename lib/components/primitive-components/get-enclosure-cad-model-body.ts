import * as jscad from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import type { Vec3 } from "@jscad/modeling/src/maths/types"
import type { CadModelBounds } from "@tscircuit/circuit-json-util"
import type { CadComponent, Point3 } from "circuit-json"
import { executeJscadOperations, type JscadOperation } from "jscad-planner"
import { Mesh, Vector3 } from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { constructAssetUrl } from "lib/utils/constructAssetUrl"
import type { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { measureFootprinterBody } from "./measure-footprinter-body"

/** Native asset axes/units, before CAD units, alignment, rotation or placement. */
export interface EnclosureCadModelBody {
  solids: Geom3[]
  bounds: CadModelBounds
  boardContactPoint?: Point3
}

interface CadModelAssetCache {
  bodies: Map<string, EnclosureCadModelBody>
  pending: Map<string, Promise<void>>
  authoredBounds: Map<CadComponent["cad_component_id"], CadModelBounds>
}

const assetCaches = new WeakMap<object, CadModelAssetCache>()
const planBodies = new WeakMap<object, EnclosureCadModelBody>()

const getAssetCache = (owner: PrimitiveComponent): CadModelAssetCache => {
  const root = owner.root
  if (!root) throw new Error("CAD asset loading requires a circuit")
  let cache = assetCaches.get(root)
  if (!cache) {
    cache = { bodies: new Map(), pending: new Map(), authoredBounds: new Map() }
    assetCaches.set(root, cache)
  }
  return cache
}

/** Staged metadata absent from Circuit JSON; includes fetched and child models. */
export const cacheEnclosureCadModelBounds = (
  owner: PrimitiveComponent,
  cad: CadComponent,
  bounds: CadModelBounds | undefined,
): void => {
  if (bounds)
    getAssetCache(owner).authoredBounds.set(cad.cad_component_id, bounds)
}

export const getCachedEnclosureCadModelBounds = (
  owner: PrimitiveComponent,
  cad: CadComponent,
): CadModelBounds | undefined =>
  getAssetCache(owner).authoredBounds.get(cad.cad_component_id)

const measureBody = (solids: Geom3[]): EnclosureCadModelBody => {
  if (
    !solids.some((solid) => jscad.geometries.geom3.toPolygons(solid).length > 0)
  ) {
    throw new Error("CAD model contains no solid geometry")
  }
  const [min, max] = jscad.measurements.measureAggregateBoundingBox(solids)
  if (![...min, ...max].every(Number.isFinite)) {
    throw new Error("CAD model contains non-finite geometry")
  }
  return {
    solids,
    bounds: {
      min: { x: min[0], y: min[1], z: min[2] },
      max: { x: max[0], y: max[1], z: max[2] },
    },
  }
}

const loadObjBody = async (url: string): Promise<EnclosureCadModelBody> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Could not load enclosure CAD body ${url}: HTTP ${response.status}`,
    )
  }
  const model = new OBJLoader().parse(await response.text())
  model.updateMatrixWorld(true)
  const faces: Vec3[][] = []
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const { geometry } = object
    const position = geometry.getAttribute("position")
    if (!position) return
    const index = geometry.getIndex()
    const count = index?.count ?? position.count
    for (let i = 0; i < count; i += 3) {
      const face: Vec3[] = []
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index ? index.getX(i + corner) : i + corner
        const point = new Vector3()
          .fromBufferAttribute(position, vertex)
          .applyMatrix4(object.matrixWorld)
        face.push([point.x, point.y, point.z])
      }
      faces.push(face)
    }
  })
  // OBJ material groups can split one watertight shell across several meshes.
  return measureBody(
    faces.length > 0 ? [jscad.geometries.geom3.fromPoints(faces)] : [],
  )
}

/**
 * Queue only supported external bodies, after all source CAD records exist.
 * Fetch/parse failures propagate through the render async-effect error path.
 * Unsupported formats remain explicitly geometry-unknown; no box is called a mesh.
 */
export const loadEnclosureCadModelAssets = (
  board: PrimitiveComponent,
): Promise<void> | undefined => {
  const cache = getAssetCache(board)
  const loading: Promise<void>[] = []
  for (const descendant of board.getDescendants()) {
    if (!descendant.pcb_component_id) continue
    const records = board
      .root!.db.cad_component.list()
      .filter((cad) => cad.pcb_component_id === descendant.pcb_component_id)
    for (const cad of records) {
      if (!cad.model_obj_url || cad.model_jscad) continue
      const url = constructAssetUrl(
        cad.model_obj_url,
        board.root?.platform?.projectBaseUrl,
      )
      if (cache.bodies.has(url)) continue
      let pending = cache.pending.get(url)
      if (!pending) {
        pending = loadObjBody(url).then((body) => {
          cache.bodies.set(url, body)
        })
        cache.pending.set(url, pending)
      }
      loading.push(pending)
    }
  }
  if (loading.length > 0) return Promise.all(loading).then(() => undefined)
}

export const getEnclosureCadModelBody = (
  owner: PrimitiveComponent | null | undefined,
  cad: CadComponent,
): EnclosureCadModelBody | undefined => {
  if (cad.model_jscad) {
    const model = cad.model_jscad
    const cached = planBodies.get(model)
    if (cached) return cached
    // Circuit JSON accepts either native geometry or a jscad-planner operation.
    let geometry: unknown = model
    if (!jscad.geometries.geom3.isA(model)) {
      // @ts-expect-error jscad-planner's legacy implementation declarations differ from modeling's overloads.
      geometry = executeJscadOperations(jscad, model as JscadOperation)
    }
    if (!jscad.geometries.geom3.isA(geometry)) {
      throw new Error(
        `${cad.cad_component_id}: JSCAD model did not produce a solid`,
      )
    }
    const body = measureBody([geometry])
    planBodies.set(model, body)
    return body
  }
  if (cad.model_obj_url && owner) {
    const url = constructAssetUrl(
      cad.model_obj_url,
      owner.root?.platform?.projectBaseUrl,
    )
    return getAssetCache(owner).bodies.get(url)
  }
  if (
    cad.model_obj_url ||
    cad.model_glb_url ||
    cad.model_gltf_url ||
    cad.model_stl_url ||
    cad.model_wrl_url ||
    cad.model_step_url
  ) {
    // A generic footprint body is not the authored asset's native geometry.
    return undefined
  }
  if (cad.footprinter_string) {
    const measured = measureFootprinterBody(cad.footprinter_string)
    if (measured)
      return { ...measured, boardContactPoint: { x: 0, y: 0, z: 0 } }
  }
  return undefined
}
