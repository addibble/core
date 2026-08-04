import { expect, test } from "bun:test"
import type { CadComponent, PcbComponent } from "circuit-json"
import { getComponentBody } from "lib/components/primitive-components/EnclosureCutoutAperture/get-component-body"

const pcbComponent = {
  rotation: 0,
  width: 12,
  height: 7,
} as unknown as PcbComponent

// Top surface of a 1.6mm board centred on Z=0.
const BOARD_SURFACE_Z = 0.8

// Measured from the real PJ-320D model. The origin is the point placed on the
// board surface, so 0.55mm of locating peg sits below it and 5.30mm of body
// above -- corroborated by that part's aperture sitting 2.7mm up, the
// barrel axis at mid-body.
const pj320d = {
  type: "cad_component",
  position: { x: 0, y: 0, z: BOARD_SURFACE_Z },
  rotation: { x: 0, y: 0, z: 0 },
  model_origin_position: { x: 7.27506, y: 0, z: -2.550001 },
  model_bounds: {
    min: { x: -1.5, y: -4, z: -3.1 },
    max: { x: 12.6, y: 4, z: 2.75 },
  },
  size: { x: 14.1, y: 8, z: 5.84998 },
} as unknown as CadComponent

const bodyOf = (overrides: Record<string, unknown> = {}) =>
  getComponentBody({
    pcbComponent,
    cadComponent: {
      ...(pj320d as object),
      ...overrides,
    } as unknown as CadComponent,
    boardSurfaceZ: BOARD_SURFACE_Z,
  })

test("above-board height comes from the measured bounds, not the extent", () => {
  const body = bodyOf()
  expect(body.aboveBoardHeight).toBeCloseTo(5.3, 4)

  // The whole point: size.z is larger, because it spans the pegs below the
  // board too. Reporting it as the part's height over-reports by 0.55mm.
  expect(body.size?.z).toBeCloseTo(5.84998, 4)
  expect(body.aboveBoardHeight!).toBeLessThan(body.size!.z!)
})

test("a model lifted off the surface adds that offset to the reach", () => {
  // zOffsetFromSurface and positionOffset.z are translations, and core has
  // already composed both into position.z by the time the record exists.
  const body = bodyOf({ position: { x: 0, y: 0, z: BOARD_SURFACE_Z + 1.5 } })
  expect(body.aboveBoardHeight).toBeCloseTo(6.8, 4)
})

test("a bottom-layer part measures from its own side of the board", () => {
  // Mounted underneath, the model sits below the board and its surface datum is
  // negative, but the reach above that surface is the same physical number.
  const body = getComponentBody({
    pcbComponent,
    cadComponent: {
      ...(pj320d as object),
      position: { x: 0, y: 0, z: -BOARD_SURFACE_Z },
    } as CadComponent,
    boardSurfaceZ: -BOARD_SURFACE_Z,
  })
  expect(body.aboveBoardHeight).toBeCloseTo(5.3, 4)
})

test("a negative board normal measures toward the minimum", () => {
  const body = bodyOf({ model_board_normal_direction: "z-" })
  expect(body.aboveBoardHeight).toBeCloseTo(0.55, 4)
})

test("without measured bounds there is no honest height", () => {
  const { model_bounds, ...withoutBounds } = pj320d as unknown as Record<
    string,
    unknown
  >
  const body = getComponentBody({
    pcbComponent,
    cadComponent: withoutBounds as unknown as CadComponent,
    boardSurfaceZ: BOARD_SURFACE_Z,
  })

  // size.z alone cannot be split, so nothing is reported and consumers fall
  // back to it explicitly rather than being handed a wrong number.
  expect(body.aboveBoardHeight).toBeUndefined()
  expect(body.size?.z).toBeCloseTo(5.84998, 4)
})

test("the rotation is the one the model is rendered at", () => {
  // cad_component.rotation.z already composes the footprint rotation with the
  // model's own pcbRotationOffset, so an asymmetric body is projected along the
  // axis it actually occupies.
  expect(bodyOf({ rotation: { x: 0, y: 0, z: 90 } }).rotation).toBeCloseTo(
    90,
    4,
  )
  expect(bodyOf({ rotation: { x: 0, y: 0, z: 45 } }).rotation).toBeCloseTo(
    45,
    4,
  )
})

test("no cad_component means only footprint facts", () => {
  const body = getComponentBody({
    pcbComponent,
    cadComponent: null,
    boardSurfaceZ: BOARD_SURFACE_Z,
  })
  expect(body.size).toBeUndefined()
  expect(body.aboveBoardHeight).toBeUndefined()
  expect(body.footprint).toEqual({ width: 12, height: 7 })
})
