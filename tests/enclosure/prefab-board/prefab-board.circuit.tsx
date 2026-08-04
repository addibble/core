import { assembly, enclosure } from "lib"
import { Dc0055a20Smt } from "./parts/dc-005-5a-2-0-smt"
import { Kh6X6X15H } from "./parts/kh-6x6x15h-smt-fs-d"
import { MicroXnj } from "./parts/micro-xnj"
import { Pj320d } from "./parts/pj-320d"
import { SmaKwe } from "./parts/sma-kwe"
import { TypeC14pCc26 } from "./parts/type-c-14p-cc-2-6"
import { UsbAfSide } from "./parts/usb-af-side"
import { UsbTypeC018 } from "./parts/usb-type-c-018"
import { Xl1608Surc06 } from "./parts/xl-1608surc-06"
import { boardHeightMm, boardWidthMm, PrefabBoard } from "./prefab-board"

export default () => (
  <assembly.device name="prefab-board-enclosure">
    <PrefabBoard>
      <UsbTypeC018 name="J1" pcbX={-18} pcbY={-boardHeightMm / 2 + 5} />
      <TypeC14pCc26
        name="J2"
        pcbX={boardWidthMm / 2 - 7.5}
        pcbY={-12}
        pcbRotation={90}
      />
      <MicroXnj
        name="J3"
        pcbX={-18}
        pcbY={boardHeightMm / 2 - 5}
        pcbRotation={180}
      />
      <UsbAfSide name="J4" pcbX={15} pcbY={boardHeightMm / 2 - 13} />
      <Dc0055a20Smt
        name="J5"
        pcbX={boardWidthMm / 2 - 5.3}
        pcbY={10}
        pcbRotation={180}
      />
      <Pj320d
        name="J6"
        pcbX={10}
        pcbY={-boardHeightMm / 2 + 7}
        pcbRotation={90}
      />
      <SmaKwe name="J7" pcbX={-boardWidthMm / 2 + 4} pcbY={-12} />
      {/*
        Bottom-mounted side connectors. A layer change mirrors a footprint in X,
        so its insertion direction turns the opposite way -- these exist to prove
        the aperture still lands on the wall the part actually faces.

        All three are at 0 or 180 degrees on purpose. Those are the rotations
        that tell a correct transform apart from one that mirrors after rotating
        instead of before; at 90 and 270 the two agree, so they would pass either
        way and prove nothing.
      */}
      <Pj320d
        name="J8"
        pcbX={-boardWidthMm / 2 + 4}
        pcbY={8}
        pcbRotation={180}
        layer="bottom"
      />
      <MicroXnj
        name="J9"
        pcbX={0}
        pcbY={boardHeightMm / 2 - 5}
        pcbRotation={180}
        layer="bottom"
      />
      <MicroXnj
        name="J10"
        pcbX={-4}
        pcbY={-boardHeightMm / 2 + 5}
        layer="bottom"
      />
      {/*
        Top-side tact switch. Its aperture is cut in the lid, centered on the
        part.

        Whether the 15mm plunger actually reaches that lid depends on the depth,
        which `topHeadroom` drives: the plunger tops out at
        floorThickness + standoffHeight + boardThickness + 15, and the lid
        underside sits at depth - lidThickness. The opening is placed correctly
        either way -- whether an actuator can *reach* it is a clearance/reach
        check, deferred to enclosure DRC along with the lid-lip interference
        case. See the parametric-enclosures RFC.
      */}
      <Kh6X6X15H name="SW1" pcbX={-5} pcbY={10} />
      {/* Bottom-side LED: its viewing window exits through the floor. */}
      <Xl1608Surc06 name="LED1" pcbX={-5} pcbY={-5} layer="bottom" />
    </PrefabBoard>
    <enclosure.fdm.box
      name="EN1"
      boardRef=".B1"
      wallThickness="2mm"
      floorThickness="2mm"
      lidThickness="2mm"
      boardClearance="0.8mm"
      standoffHeight="8mm"
      topHeadroom="11mm"
      lidLipDepth="4mm"
    />
  </assembly.device>
)
