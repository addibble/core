import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"
import { getReferencedEnclosureBoard } from "lib/components/primitive-components/get-referenced-enclosure-board"
import { Euler, MathUtils, Matrix4 } from "three"

test("authored screws, bolts, columns and spacers emit actual support keepouts and late DRC", async () => {
  for (const kind of ["screw", "bolt", "column", "spacer"] as const) {
    const { circuit, solverOutput, generatedKeepouts, getSolveCount } =
      await getMountingKeepoutFixture({ kind })
    const keepouts = generatedKeepouts()
    expect(keepouts).toHaveLength(2)
    const boss = keepouts.find((keepout) => keepout.layers.includes("bottom"))
    if (boss?.shape !== "circle")
      throw new Error("Expected bottom boss keepout")
    expect(boss.center).toEqual({ x: 100, y: 200 })
    expect(boss.radius).toBeCloseTo(
      solverOutput.mounts[0]!.bossDiameterMm / 2 + 0.5,
    )
    const board = getReferencedEnclosureBoard(circuit.firstChild!, ".B1")
    expect(boss.subcircuit_id).toBe(board.subcircuit_id ?? undefined)
    expect(circuit.db.pcb_component.get(boss.pcb_component_id!)).toMatchObject({
      do_not_place: true,
      obstructs_within_bounds: false,
    })
    {
      const top = keepouts.find((keepout) => keepout.layers.includes("top"))
      if (top?.shape !== "circle")
        throw new Error("Expected top support keepout")
      expect(top.center).toEqual(boss.center)
      expect(top.radius).toBeCloseTo(
        (kind === "column"
          ? solverOutput.mounts[0]!.lidColumn!.diameterMm
          : kind === "spacer"
            ? solverOutput.mounts[0]!.spacer!.spec.outerDiameterMm
            : solverOutput.mounts[0]!.fastener.head.diameterMm) /
          2 +
          0.5,
      )
    }
    const circuitJson = circuit.getCircuitJson()
    const componentErrors = checkPcbComponentOverKeepout(circuitJson)
    const copperErrors = checkPcbCopperOverKeepout(circuitJson)
    expect(componentErrors.length).toBeGreaterThan(0)
    expect(copperErrors.length).toBeGreaterThan(0)
    expect(
      componentErrors.some((error) => error.message.includes("BOTTOM")),
    ).toBe(true)
    expect(componentErrors.some((error) => error.message.includes("TOP"))).toBe(
      true,
    )
    for (const expected of [...componentErrors, ...copperErrors]) {
      expect(
        circuit.db.pcb_placement_error
          .list()
          .filter((error) => error.message === expected.message),
      ).toHaveLength(1)
    }
    const hardware = circuit.db.cad_component
      .list()
      .filter((cad) => cad.footprinter_string)
    expect(hardware).toHaveLength(
      kind === "screw" ? 1 : kind === "spacer" ? 3 : 2,
    )
    for (const cad of hardware) {
      expect(cad.model_origin_position).toEqual({ x: 0, y: 0, z: 0 })
      expect(cad.size).toBeUndefined()
      expect(
        circuit.db.source_component.get(cad.source_component_id!),
      ).not.toBeNull()
      expect(circuit.db.pcb_component.get(cad.pcb_component_id)).toMatchObject({
        do_not_place: true,
        obstructs_within_bounds: false,
      })
    }
    const enclosureCad = circuit.db.cad_component
      .list()
      .find((cad) => cad.model_jscad)!
    for (const piece of solverOutput.hardware) {
      const source = circuit.db.source_component.getWhere({
        name: `EN1_${piece.id}`,
      })!
      const cad = hardware.find(
        (cad) => cad.source_component_id === source.source_component_id,
      )!
      if (!cad.rotation)
        throw new Error("Expected serialized hardware rotation")
      const expectedMatrix = new Matrix4()
        .makeTranslation(
          enclosureCad.position.x,
          enclosureCad.position.y,
          enclosureCad.position.z,
        )
        .multiply(new Matrix4().fromArray(piece.enclosureFromPart))
      const actualMatrix = new Matrix4()
        .makeRotationFromEuler(
          new Euler(
            MathUtils.degToRad(cad.rotation.x),
            MathUtils.degToRad(cad.rotation.y),
            MathUtils.degToRad(cad.rotation.z),
            "XYZ",
          ),
        )
        .setPosition(cad.position.x, cad.position.y, cad.position.z)
      for (let index = 0; index < 16; index++) {
        expect(actualMatrix.elements[index]).toBeCloseTo(
          expectedMatrix.elements[index]!,
          8,
        )
      }
    }
    const before = JSON.stringify(circuit.getCircuitJson())
    const solves = getSolveCount()
    await circuit.renderUntilSettled()
    expect(JSON.stringify(circuit.getCircuitJson())).toBe(before)
    expect(getSolveCount()).toBe(solves)
  }
})
