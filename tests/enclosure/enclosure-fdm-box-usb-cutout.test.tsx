import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("generates an FDM enclosure and USB-C aperture with the enclosure solver", async () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined

  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <assembly.device name="usb-device">
      <board name="main-board" width="40mm" height="24mm" routingDisabled>
        <connector
          name="USB1"
          manufacturerPartNumber="USB_C_TEST"
          pcbX="0mm"
          pcbY="11mm"
          allowOffBoard
          pinLabels={{ pin1: ["VBUS"], pin2: ["GND"] }}
          footprint={
            <footprint insertionDirection="from_top">
              <smtpad
                portHints={["pin1"]}
                pcbX="-1.5mm"
                pcbY="0mm"
                width="1mm"
                height="4mm"
                shape="rect"
              />
              <smtpad
                portHints={["pin2"]}
                pcbX="1.5mm"
                pcbY="0mm"
                width="1mm"
                height="4mm"
                shape="rect"
              />
            </footprint>
          }
          cadModel={{
            objUrl:
              "https://modelcdn.tscircuit.com/easyeda_models/assets/C165948.obj?uuid=617b05f9bba7410b96c001093d8189e4",
            pcbRotationOffset: 0,
            modelOriginPosition: {
              x: 0,
              y: -2.7500289000000517,
              z: 0.000010999999999872223,
            },
          }}
        >
          <enclosure.cutoutaperture
            shape="pill"
            width="9mm"
            height="3.6mm"
            margin="0.5mm"
          />
        </connector>
      </board>
      <enclosure.fdm.box boardRef=".main-board" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  expect(enclosureSolverEvent?.solverName).toBe("CreateFdmEnclosureSolver")
  expect(enclosureSolverEvent?.solverParams.board).toEqual({
    width: 40,
    height: 24,
    thickness: 1.4,
  })
  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    shape: "pill",
    // The part is at y=+11 on a 24mm-tall board and authors `from_top`, which
    // is +Y, so its opening pierces the +Y wall.
    face: "y_pos",
  })
  expect(enclosureSolverEvent?.solverParams.apertures[0].center.x).toBeCloseTo(
    0,
  )
  // Core leaves the offsets unset when the part does not author them;
  // create-fdm-enclosure resolves the compatibility fallback (half the
  // aperture's own 3.6mm + 2x0.5mm margin extent = 2.3mm).
  expect(
    enclosureSolverEvent?.solverParams.apertures[0].heightDimensionOffset,
  ).toBeUndefined()
  expect(enclosureSolverEvent?.solverConstructorArgs).toEqual([
    enclosureSolverEvent?.solverParams,
  ])
  // The enclosure ships only as a typed record; no cad_component carries a plan.
  expect(
    circuit.db.cad_component.list().filter((cad) => cad.model_jscad),
  ).toHaveLength(0)
  expect(circuit.db.source_assembly_device.list()).toHaveLength(1)
  expect(circuit.db.source_fdm_enclosure.list()).toHaveLength(1)
  expect(circuit.db.source_cutout_aperture.list()).toHaveLength(1)
  // One record per printed part: the base and the lid are separate prints, and
  // a viewer has to be able to hide one without the other.
  expect(
    circuit.db.cad_fdm_enclosure.list().map((part) => part.enclosure_part),
  ).toEqual(["base", "lid"])

  await expect(circuit).toMatchSimple3dSnapshot(import.meta.path, {
    camPos: [30, 24, 50],
    poppygl: {
      lookAt: [0, 0, 3.5],
      backgroundColor: [1, 1, 1],
      grid: false,
    },
  })

  await expect(circuit).toMatchSimple3dSnapshot(import.meta.path, {
    snapshotSuffix: "top-down-orthographic",
    cameraPreset: "top_down_orthographic",
    poppygl: {
      backgroundColor: [1, 1, 1],
      grid: false,
    },
  })
})
