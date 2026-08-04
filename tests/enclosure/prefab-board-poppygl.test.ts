import { expect, test } from "bun:test"
// Registers toMatchSimple3dSnapshot. Imported explicitly so this file passes on
// its own, not only when another test happens to pull in get-test-fixture.
import "tests/fixtures/extend-expect-3d-matcher"
import { renderPrefabBoardCircuitJson } from "./prefab-board/render-prefab-board"

/**
 * Validates that each enclosure wall's aperture cutouts line up with the
 * connectors on that wall.
 *
 * The walls are rendered OPAQUE and viewed straight-on from OUTSIDE each face,
 * so a correctly-placed cutout shows its connector poking cleanly through the
 * hole. Translucent walls / corner isometrics are deliberately avoided here:
 * with a see-through lid the opposite wall's slots project on top of the near
 * wall, and a corner view places an adjacent wall's cutout next to the wall
 * under inspection - both make correct geometry look "swapped".
 *
 * Circuit Z-up maps to the glTF frame as (x, y, z) -> (-x, z, y), so physical
 * +X (right) is rendered at world -X and physical -Y (back) at world -Z.
 *
 * The camera sits close enough that one wall fills most of the frame; a distant
 * camera shrinks the wall to a few hundred pixels and the snapshot stops being
 * sensitive to a small aperture shift.
 */
test(
  "prefab-board enclosure cutouts align with connectors on every wall",
  async () => {
    const circuitJson = await renderPrefabBoardCircuitJson()

    const cameraDistance = 105

    // Straight-on external elevation of each wall. The caption goes into the
    // image because a 3D view of the wrong wall still looks like a plausible
    // render - naming the parts that must appear is what makes a bad snapshot
    // obvious in a diff instead of merely different.
    const walls: Array<{
      name: string
      camPos: [number, number, number]
      caption: string[]
    }> = [
      {
        // world -X wall == physical +X
        name: "wall-physical-right",
        camPos: [-cameraDistance, 6, 0],
        caption: [
          "Right wall (+X), viewed straight on",
          "Must show 2 cutouts: J2 vertical USB-C, J5 DC barrel jack",
        ],
      },
      {
        // world +X wall == physical -X
        name: "wall-physical-left",
        camPos: [cameraDistance, 6, 0],
        caption: [
          "Left wall (-X), viewed straight on",
          "Must show 2 cutouts: J7 SMA, and J8 DC barrel jack",
          "J8 is bottom-mounted, so it sits lower than J7",
        ],
      },
      {
        // world -Z wall == physical -Y
        name: "wall-physical-back",
        camPos: [0, 6, -cameraDistance],
        caption: [
          "Back wall (-Y), viewed straight on",
          "Must show 3 cutouts: J1 USB-C, J6 audio jack, J10 micro-USB",
          "J10 is bottom-mounted, so it sits lower than J1 and J6",
        ],
      },
      {
        // world +Z wall == physical +Y
        name: "wall-physical-front",
        camPos: [0, 6, cameraDistance],
        caption: [
          "Front wall (+Y), viewed straight on",
          "Must show 3 cutouts: J3 micro-USB, J4 USB-A, J9 micro-USB",
          "J9 is bottom-mounted, so it sits lower than J3 and J4",
        ],
      },
      {
        name: "face-physical-top",
        camPos: [0, cameraDistance, 0.001],
        caption: [
          "Lid, viewed straight down",
          "Must show 1 cutout: SW1's plunger hole",
        ],
      },
      {
        name: "face-physical-bottom",
        camPos: [0, -cameraDistance, 0.001],
        caption: [
          "Floor, viewed straight up",
          "Must show 1 cutout: LED1's viewing window",
        ],
      },
    ]

    for (const wall of walls) {
      await expect(circuitJson).toMatchSimple3dSnapshot(import.meta.path, {
        snapshotSuffix: wall.name,
        camPos: wall.camPos,
        caption: wall.caption,
        poppygl: {
          width: 1100,
          height: 520,
          supersampling: 2,
          lookAt: [0, 6, 0],
          up: "y+",
          backgroundColor: [1, 1, 1],
          grid: false,
        } as any,
      })
    }
  },
  { timeout: 180_000 },
)
