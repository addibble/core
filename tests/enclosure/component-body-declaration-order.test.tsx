import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const footprint = (
  <footprint insertionDirection={"from_top" as any}>
    <smtpad
      shape="rect"
      portHints={["pin1"]}
      pcbX={0}
      pcbY={0}
      width={2}
      height={2}
    />
  </footprint>
)

const solveWith = async ({
  enclosureFirst,
  cadModel,
}: {
  enclosureFirst: boolean
  cadModel: any
}) => {
  const { circuit } = getTestFixture()
  let event: SolverStartedEvent | undefined
  circuit.on("solver:started", (e) => {
    if (e.solverName === "CreateFdmEnclosureSolver") event = e
  })

  const board = (
    <board name="B1" width="40mm" height="24mm" routingDisabled>
      <chip
        name="U1"
        pcbX={0}
        pcbY={10}
        footprint={footprint}
        cadModel={cadModel}
      >
        <enclosure.cutoutaperture shape="rect" width="4mm" height="4mm" />
      </chip>
    </board>
  )
  const box = <enclosure.fdm.box boardRef=".B1" />

  circuit.add(
    <assembly.device name="dev">
      {enclosureFirst ? box : board}
      {enclosureFirst ? board : box}
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  return (event as any)?.solverParams.apertures[0]?.componentBody
}

const objectModel = {
  objUrl: "https://example.com/x.obj",
  size: { x: 6, y: 15, z: 8 },
}

// Render phases walk the tree depth-first in sibling declaration order, so
// while the enclosure shared `CadModelRender` with the parts it contains, an
// enclosure declared before the board saw no cad_components at all and every
// aperture silently fell back to footprint dimensions. `EnclosureRender` runs
// after `CadModelRender` so the order cannot matter.
test("component body survives the enclosure being declared before the board", async () => {
  const after = await solveWith({
    enclosureFirst: false,
    cadModel: objectModel,
  })
  const before = await solveWith({
    enclosureFirst: true,
    cadModel: objectModel,
  })

  expect(after?.size).toMatchObject({ x: 6, y: 15, z: 8 })
  expect(before?.size).toMatchObject({ x: 6, y: 15, z: 8 })
  expect(before).toEqual(after)
})

// The record is the normalized form every authoring path converges on, so a
// `<cadmodel>` child now reports the same facts as the object prop. Reading
// `_parsedProps.cadModel` saw nothing here.
test("a cadmodel child reports the same body as the object prop", async () => {
  const viaObject = await solveWith({
    enclosureFirst: false,
    cadModel: objectModel,
  })
  const viaChild = await solveWith({
    enclosureFirst: false,
    cadModel: (
      <cadmodel
        modelUrl="https://example.com/x.obj"
        size={{ x: 6, y: 15, z: 8 }}
      />
    ),
  })

  expect(viaChild?.size).toMatchObject({ x: 6, y: 15, z: 8 })
  expect(viaChild?.size).toEqual(viaObject?.size)
})
