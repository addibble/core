import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("cutout apertures survive isolated subcircuit inflation", async () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <assembly.device>
      <board name="B1" width="30mm" height="20mm" routingDisabled>
        <subcircuit name="connectors" _subcircuitCachingEnabled>
          <chip
            name="U1"
            pcbX="14mm"
            pinLabels={{ pin1: "IO" }}
            footprint={
              <footprint insertionDirection="from_right">
                <smtpad
                  portHints={["pin1"]}
                  width="2mm"
                  height="2mm"
                  shape="rect"
                />
              </footprint>
            }
          >
            <enclosure.cutoutaperture shape="circle" radius="2mm" />
          </chip>
        </subcircuit>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  expect(enclosureSolverEvent?.solverParams.apertures).toHaveLength(1)
  expect(circuit.db.source_cutout_aperture.list()).toHaveLength(1)
})
