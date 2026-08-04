import { enclosure } from "lib"
import type { ReactNode } from "react"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
  pin4: ["pin4"],
} as const

/**
 * KH-6x6x15H-SMT-FS-D: a 6x6mm tactile switch with a 15mm plunger. The stem has
 * to exit the enclosure on the side of the board the switch is mounted on, which
 * is what `insertionDirection="from_above"` declares.
 */
export interface Kh6X6X15HProps {
  name: string
  pcbX: number
  pcbY: number
  pcbRotation?: number
  layer?: "top" | "bottom"
  children?: ReactNode
}

export const Kh6X6X15H = ({
  name,
  pcbX,
  pcbY,
  pcbRotation,
  layer,
  children,
}: Kh6X6X15HProps) => (
  <chip
    name={name}
    manufacturerPartNumber="KH_6X6X15H_SMT_FS_D"
    supplierPartNumbers={{ jlcpcb: ["C18186519"] }}
    pinLabels={pinLabels}
    footprint={
      <footprint insertionDirection="from_above">
        {/* 6x6mm tact switch, gull-wing pads on both sides. */}
        <smtpad
          portHints={["pin1"]}
          pcbX="-4.200017mm"
          pcbY="2.249805mm"
          width="1.850009mm"
          height="1.0999978mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin2"]}
          pcbX="4.200017mm"
          pcbY="2.249805mm"
          width="1.850009mm"
          height="1.0999978mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin3"]}
          pcbX="-4.200017mm"
          pcbY="-2.249805mm"
          width="1.850009mm"
          height="1.0999978mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin4"]}
          pcbX="4.200017mm"
          pcbY="-2.249805mm"
          width="1.850009mm"
          height="1.0999978mm"
          shape="rect"
        />
        <silkscreenpath
          route={[
            { x: -3.048, y: -3.048 },
            { x: 3.048, y: -3.048 },
            { x: 3.048, y: 3.048 },
            { x: -3.048, y: 3.048 },
            { x: -3.048, y: -3.048 },
          ]}
        />
      </footprint>
    }
    cadModel={{
      objUrl:
        "https://modelcdn.tscircuit.com/easyeda_models/assets/C18186519.obj?uuid=152d242aeb424b63a926a84b518edee1",
      pcbRotationOffset: 0,
      modelOriginPosition: { x: -0.0000127, y: 0.00005, z: 0 },
    }}
    pcbX={pcbX}
    pcbY={pcbY}
    pcbRotation={pcbRotation}
    layer={layer}
  >
    {children ?? (
      // Clearance for the 3.5mm plunger. No height offset: a horizontal
      // face takes its height from the plate it pierces.
      <enclosure.cutoutaperture shape="circle" radius={1.9} margin={0.3} />
    )}
  </chip>
)
