import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  CadComponent,
  CadFdmEnclosure,
} from "circuit-json"
import { renderPrefabBoardCircuitJson } from "./prefab-board/render-prefab-board"

/**
 * Every connector body must sit on the same enclosure wall as its aperture
 * cutout, at the same along-wall position.
 *
 * The aperture positions are read straight out of the emitted `model_jscad`
 * plan: each cutout is a `translate` operand of the shell's `subtract`, so the
 * wall it pierces and where it sits along that wall are explicit in the tree.
 * There is no need to execute the geometry and hunt for holes in a mesh.
 *
 * Scope: this compares enclosure geometry to connector placement in **Circuit
 * world coordinates**. Whether a renderer then maps mesh vertices and CAD node
 * translations into the same frame is a separate invariant, owned by
 * `circuit-json-to-gltf/tests/unit/jscad-plan.test.ts` (mesh/node axis parity) -
 * that is the layer where the historical double-negated-X bug lived.
 */

type Wall = "left" | "right" | "front" | "back"

/** Which axis the aperture slides along, per wall. */
const tangentAxisOf = (wall: Wall): "x" | "y" =>
  wall === "left" || wall === "right" ? "y" : "x"

const isTranslate = (
  node: unknown,
): node is { type: "translate"; vector: [number, number, number] } =>
  typeof node === "object" &&
  node !== null &&
  (node as { type?: unknown }).type === "translate" &&
  Array.isArray((node as { vector?: unknown }).vector)

/**
 * Collect the cutout operands of the first `subtract` reachable in the plan.
 * The assembled plan is `union(base-with-cuts, lid-with-cuts)` and every
 * aperture is subtracted from both shells, so one shell's operands are the
 * complete aperture set.
 */
const collectCutouts = (
  plan: unknown,
): Array<{ vector: [number, number, number] }> => {
  const node = plan as { type?: string; shapes?: unknown[] }
  if (node?.type === "subtract" && node.shapes) {
    return node.shapes.slice(1).filter(isTranslate)
  }
  if (node?.type === "union" && node.shapes) {
    for (const shape of node.shapes) {
      const found = collectCutouts(shape)
      if (found.length > 0) return found
    }
  }
  return []
}

test("every connector body and its aperture cutout land on the same wall aligned", async () => {
  const circuitJson =
    (await renderPrefabBoardCircuitJson()) as AnyCircuitElement[]

  const nameBySourceId = new Map<string, string>()
  for (const element of circuitJson) {
    if (element.type === "source_component") {
      nameBySourceId.set(element.source_component_id, element.name)
    }
  }

  // Connectors are ordinary CAD components; the enclosure is a typed record with
  // no PCB owner, so the two never need disambiguating by `model_jscad`.
  const connectors = circuitJson
    .filter(
      (element): element is CadComponent => element.type === "cad_component",
    )
    .map((cad) => ({
      name:
        nameBySourceId.get(cad.source_component_id) ?? cad.source_component_id,
      x: cad.position.x,
      y: cad.position.y,
    }))

  expect(connectors).toHaveLength(12)

  // Only the ten side-entry connectors participate in nearest-wall matching.
  // SW1 (lid) and LED1 (floor) exit through horizontal faces and are covered by
  // the face-specific assertions in prefab-board-circuit.test.tsx.
  //
  // J8, J9 and J10 are bottom-mounted. A layer change mirrors a footprint in X,
  // so their insertion directions turn the opposite way, and each is placed at a
  // rotation where getting that backwards would move its cutout to the opposite
  // wall -- which this test would catch as a wall or tangent mismatch.
  const sideConnectors = connectors.filter((c) => /^J\d+$/.test(c.name))
  expect(sideConnectors).toHaveLength(10)

  const enclosure = circuitJson.find(
    (element): element is CadFdmEnclosure =>
      element.type === "cad_fdm_enclosure",
  )
  expect(enclosure?.size).toBeDefined()
  const halfWidth = enclosure!.size!.x / 2
  const halfHeight = enclosure!.size!.y / 2

  // Which parts mate along Z, i.e. exit through the lid or the floor rather than
  // a side wall. Identified from the record itself, not from where its cut landed
  // -- cuts are projected inboard of their face by a part-dependent amount, so
  // any coordinate-band heuristic would be fragile. Both Z names appear: a
  // bottom-layer part authored `from_above` reports `from_below`, because a
  // layer flip is a 180 degree rotation about Y and so inverts Z.
  const verticalComponents = circuitJson
    .filter(
      (element) =>
        element.type === "pcb_component" &&
        (element.insertion_direction === "from_above" ||
          element.insertion_direction === "from_below"),
    )
    .map((element) => {
      const pcb = element as {
        source_component_id: string
        center: { x: number; y: number }
      }
      return {
        name: nameBySourceId.get(pcb.source_component_id),
        ...pcb.center,
      }
    })
  expect(verticalComponents.map((c) => c.name).sort()).toEqual(["LED1", "SW1"])

  // Cutout vectors are enclosure-local; the enclosure is centered on the board,
  // so adding its own XY position puts them in Circuit world coordinates.
  const allCutouts = collectCutouts(enclosure!.model_jscad).map(
    ({ vector }) => ({
      x: enclosure!.position.x + vector[0],
      y: enclosure!.position.y + vector[1],
      claimed: false,
    }),
  )
  expect(allCutouts).toHaveLength(12)

  // A lid/floor cut sits at its own part's XY, so claim those by proximity and
  // leave the seven side-wall cuts for nearest-wall matching below.
  const cutouts = [...allCutouts]
  for (const vertical of verticalComponents) {
    let nearest = 0
    for (let i = 1; i < cutouts.length; i++) {
      const d = (c: (typeof cutouts)[number]) =>
        (c.x - vertical.x) ** 2 + (c.y - vertical.y) ** 2
      if (d(cutouts[i]!) < d(cutouts[nearest]!)) nearest = i
    }
    cutouts.splice(nearest, 1)
  }
  expect(cutouts).toHaveLength(10)

  /** Nearest wall by distance to each wall plane (robust near corners). */
  const wallOf = (x: number, y: number): Wall => {
    const distances: Array<[Wall, number]> = [
      ["right", Math.abs(halfWidth - x)],
      ["left", Math.abs(x + halfWidth)],
      ["back", Math.abs(halfHeight - y)],
      ["front", Math.abs(y + halfHeight)],
    ]
    distances.sort((a, b) => a[1] - b[1])
    return distances[0]![0]
  }

  for (const connector of sideConnectors) {
    const wall = wallOf(connector.x, connector.y)
    const tangentAxis = tangentAxisOf(wall)
    const candidates = cutouts.filter(
      (cutout) => wallOf(cutout.x, cutout.y) === wall,
    )
    expect(
      candidates.length,
      `${connector.name} has no cutout on its ${wall} wall`,
    ).toBeGreaterThan(0)

    let best = candidates[0]!
    for (const candidate of candidates) {
      if (
        Math.abs(candidate[tangentAxis] - connector[tangentAxis]) <
        Math.abs(best[tangentAxis] - connector[tangentAxis])
      ) {
        best = candidate
      }
    }
    const offBy = Math.abs(best[tangentAxis] - connector[tangentAxis])
    // Tight on purpose: the aperture tangent and the connector body both derive
    // from the same pcb_component placement, so they should agree to well under
    // a millimetre. A mirrored axis shows up as roughly twice the offset.
    expect(
      offBy,
      `${connector.name} cutout on the ${wall} wall is ${offBy.toFixed(2)}mm off along ${tangentAxis}`,
    ).toBeLessThan(1)
    best.claimed = true
  }

  // Physical wall split. The bottom-mounted parts each join a wall that already
  // has a top-mounted connector, so a mirrored insertion direction would show up
  // here as a wall with the wrong number of cutouts.
  expect(cutouts.filter((c) => wallOf(c.x, c.y) === "right")).toHaveLength(2)
  expect(cutouts.filter((c) => wallOf(c.x, c.y) === "left")).toHaveLength(2)
  expect(cutouts.filter((c) => wallOf(c.x, c.y) === "front")).toHaveLength(3)
  expect(cutouts.filter((c) => wallOf(c.x, c.y) === "back")).toHaveLength(3)

  for (const cutout of cutouts) {
    expect(
      cutout.claimed,
      `cutout at (${cutout.x}, ${cutout.y}) has no connector aligned to it`,
    ).toBe(true)
  }
})
