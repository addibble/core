import { expect, test } from "bun:test"
import { convertCircuitJsonTo3D } from "circuit-json-to-gltf"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("authored mounting hardware exports physical geometry at its assembled board datums", async () => {
  for (const kind of ["screw", "spacer"] as const) {
    const { circuit, solverInput, solverOutput } =
      await getMountingKeepoutFixture({ kind })
    const hardwareCad = circuit.db.cad_component
      .list()
      .filter((cad) => cad.footprinter_string)
    const mount = solverOutput.mounts[0]!
    expect(hardwareCad).toHaveLength(kind === "screw" ? 1 : 3)

    for (const cad of hardwareCad) {
      const source = circuit.db.source_component.get(cad.source_component_id)!
      const piece = solverOutput.hardware.find(
        (piece) => source.name === `EN1_${piece.id}`,
      )!
      const scene = await convertCircuitJsonTo3D([cad], {
        renderBoardTextures: false,
        drawFauxBoard: false,
      })
      expect(scene.boxes).toHaveLength(1)
      const box = scene.boxes[0]!
      if (!box.mesh) throw new Error(`Missing physical mesh for ${source.name}`)
      expect(box.mesh.triangles.length).toBeGreaterThan(100)
      // Exporter scene is Y-up; Circuit JSON and solver remain Z-up.
      expect(box.center).toEqual({
        x: cad.position.x,
        y: cad.position.z,
        z: cad.position.y,
      })
      const { min, max } = box.mesh.boundingBox
      if (piece.role === "screw") {
        expect(min.y).toBeCloseTo(mount.fastener.landmarks.tipZMm, 5)
        expect(max.y).toBeCloseTo(mount.fastener.landmarks.headTopZMm, 5)
        expect(max.x - min.x).toBeCloseTo(mount.fastener.head.diameterMm, 5)
        expect(box.center.y + min.y).toBeLessThan(
          -solverInput.board.thickness / 2,
        )
      } else if (piece.role === "insert") {
        expect(max.y - min.y).toBeCloseTo(mount.insert!.lengthMm, 5)
        expect(box.center.y + max.y).toBeCloseTo(
          -solverInput.board.thickness / 2,
          5,
        )
      } else {
        expect(max.y - min.y).toBeCloseTo(mount.spacer!.lengthMm, 5)
        expect(max.x - min.x).toBeCloseTo(mount.spacer!.spec.outerDiameterMm, 5)
        expect(box.center.y + min.y).toBeCloseTo(
          solverInput.board.thickness / 2,
          5,
        )
      }
    }

    // Export the original generated CAD records through glTF. Hide only the
    // enclosing shell/board so the seated insert and spacer remain visible.
    await expect(hardwareCad).toMatchSimple3dSnapshot(import.meta.path, {
      snapshotSuffix: kind,
      gltf: { drawFauxBoard: false },
      // The glTF convenience exporter defaults to flipping board X.
      camPos: [-78, 20, 225],
      poppygl: {
        lookAt: [-100, 2, 200],
        backgroundColor: [1, 1, 1],
        grid: false,
      },
    })
  }
})
