import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("connector serializes an optional cutout aperture", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <connector
      name="J1"
      pinLabels={{ pin1: "1", pin2: "2" }}
      footprint="pinrow2"
    >
      <cutoutaperture
        shape="rounded_rect"
        widthMm="3.66mm"
        heightMm={8.34}
        cornerRadiusMm="1.83mm"
        zCenterAboveBoardMm={6.75}
      />
    </connector>,
  )

  circuit.render()

  expect(circuit.db.source_component.list()[0].cutout_aperture).toEqual({
    shape: "rounded_rect",
    width_mm: 3.66,
    height_mm: 8.34,
    corner_radius_mm: 1.83,
    z_center_above_board_mm: 6.75,
  })
})

test("omitting cutoutAperture leaves existing source output unchanged", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <connector
      name="J1"
      pinLabels={{ pin1: "1", pin2: "2" }}
      footprint="pinrow2"
    />,
  )

  circuit.render()

  expect(circuit.db.source_component.list()[0].cutout_aperture).toBeUndefined()
})

test("common aperture metadata survives a component-specific attachment hook", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <interconnect name="JP1" standard="0603">
      <cutoutaperture shape="circle" diameterMm={4} />
    </interconnect>,
  )

  circuit.render()

  expect(circuit.db.source_component.list()[0].cutout_aperture).toEqual({
    shape: "circle",
    diameter_mm: 4,
  })
})
