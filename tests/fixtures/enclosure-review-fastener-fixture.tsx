import type {
  AssemblyScrewProps,
  EnclosureFdmHeatsetInsertProps,
} from "@tscircuit/props"
import { booleans, measurements, primitives } from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import type { Vec3 } from "@jscad/modeling/src/maths/types"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "./get-test-fixture"
import { writeEnclosureReviewGeometry } from "./enclosure-review-geometry"

type Override =
  | { screw: Omit<AssemblyScrewProps, "thread">; insert?: never }
  | { insert: Omit<EnclosureFdmHeatsetInsertProps, "thread">; screw?: never }

/** Probe solid material in glTF world: right-handed Y-up mm, point centre. */
export const enclosureReviewProbeVolume = (
  solid: Geom3,
  center: Vec3,
  size: Vec3,
) =>
  measurements.measureVolume(
    booleans.intersect(solid, primitives.cuboid({ center, size })),
  )

export const getEnclosureReviewFastenerFixture = async (
  testPath: string,
  override: Override,
  caption: string,
) => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device name="DEVICE">
      <board name="B1" width={40} height={24} thickness={1.6} routingDisabled>
        <hole name="CONTROL" pcbX={8} diameter={3.4}>
          {override.insert ? (
            <>
              <enclosure.fdm.heatsetinsert thread="m3" />
              <assembly.bolt thread="m3" />
            </>
          ) : (
            <assembly.screw thread="m3" />
          )}
        </hole>
        <hole name="AUTHORED" pcbX={-8} diameter={3.4}>
          {override.insert ? (
            <>
              <enclosure.fdm.heatsetinsert thread="m3" {...override.insert} />
              <assembly.bolt thread="m3" />
            </>
          ) : (
            <assembly.screw thread="m3" {...override.screw} />
          )}
        </hole>
      </board>
      {/* Room for 12mm engagement AND 9mm tip clearance, without a floor breach. */}
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={24} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = await circuit.getCircuitJson()
  const closeUp =
    override.screw?.pilotDiameter !== undefined ||
    override.screw?.boreEntryChamfer !== undefined ||
    override.insert?.boreEntryChamfer !== undefined
  const geometry = await writeEnclosureReviewGeometry({
    circuitJson,
    testPath,
    section: closeUp
      ? { center: [0, -2, 0], size: [26, 12, 0.6] }
      : { center: [0, -10, 0], size: [32, 38, 0.6] },
    caption: `LEFT default / RIGHT authored: ${caption}`,
    evidence: { override },
  })
  const hardware = (
    family: "screw" | "heatsetinsert",
    role: "control" | "authored",
  ) => {
    const x = role === "authored" ? -8 : 8
    const cad = circuit.db.cad_component
      .list()
      .find(
        (cad) =>
          cad.footprinter_string?.startsWith(`${family}_`) &&
          cad.position.x === x,
      )
    if (!cad) throw new Error(`Missing emitted ${family} at X=${x}`)
    const source = circuit.db.source_component.get(cad.source_component_id)
    if (!source) throw new Error(`Missing source for ${cad.cad_component_id}`)
    return geometry.solidNamed(source.name)
  }
  const pcb = circuit.db.pcb_board.list()[0]
  if (!pcb?.thickness) throw new Error("Fixture did not emit board thickness")
  return {
    ...geometry,
    circuit,
    shell: geometry.solidNamed("EN1"),
    hardware,
    axisX: (
      family: "screw" | "heatsetinsert",
      role: "control" | "authored",
    ) => {
      const [min, max] = measurements.measureBoundingBox(hardware(family, role))
      return (min[0] + max[0]) / 2
    },
    boardBottomY: -pcb.thickness / 2,
  }
}
