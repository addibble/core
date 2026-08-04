import { enclosure } from "lib"
import type { ReactNode } from "react"

const pinLabels = {
  pin1: ["cathode", "neg"],
  pin2: ["anode", "pos"],
} as const

/**
 * XL-1608SURC-06: an 0603 SMD LED. Mounted on the board bottom in the prefab
 * fixture, so its viewing aperture exits through the enclosure floor.
 */
export interface Xl1608Surc06Props {
  name: string
  pcbX: number
  pcbY: number
  pcbRotation?: number
  layer?: "top" | "bottom"
  children?: ReactNode
}

export const Xl1608Surc06 = ({
  name,
  pcbX,
  pcbY,
  pcbRotation,
  layer,
  children,
}: Xl1608Surc06Props) => (
  <diode
    name={name}
    manufacturerPartNumber="XL_1608SURC_06"
    supplierPartNumbers={{ jlcpcb: ["C965799"] }}
    footprint={
      <footprint insertionDirection="from_above">
        <smtpad
          portHints={["pin1"]}
          pcbX="-0.7489952mm"
          pcbY="-0.003429mm"
          width="0.7999984mm"
          height="0.7999984mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin2"]}
          pcbX="0.7489952mm"
          pcbY="0.003429mm"
          width="0.7999984mm"
          height="0.7999984mm"
          shape="rect"
        />
      </footprint>
    }
    cadModel={{
      objUrl:
        "https://modelcdn.tscircuit.com/easyeda_models/assets/C965799.obj?uuid=d0740cb8891c49a88b6949cb978926f3",
      pcbRotationOffset: 0,
      modelOriginPosition: { x: -0.0000127, y: 0.0000508, z: -0.01 },
    }}
    pcbX={pcbX}
    pcbY={pcbY}
    pcbRotation={pcbRotation}
    layer={layer}
  >
    {children ?? (
      // Light exit window through the enclosure floor.
      <enclosure.cutoutaperture shape="circle" radius={1.1} margin={0.2} />
    )}
  </diode>
)
