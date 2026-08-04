import { enclosure } from "lib"
import { Fragment, type ReactNode } from "react"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["SH1"],
  pin3: ["SH3"],
  pin4: ["B8"],
  pin5: ["A5"],
  pin6: ["B7"],
  pin7: ["A6"],
  pin8: ["A7"],
  pin9: ["B6"],
  pin10: ["A8"],
  pin11: ["B5"],
  pin12: ["A1"],
  pin13: ["B12"],
  pin14: ["A4"],
  pin15: ["B9"],
  pin16: ["B4"],
  pin17: ["A9"],
  pin18: ["B1"],
  pin19: ["A12"],
  pin20: ["SH2"],
} as const

const shellPins = [
  ["pin2", 4.325112, -2.77408635, 1.4, 1.8],
  ["pin1", 4.325112, 1.40573765, 1.6, 2],
  ["pin20", -4.325112, 1.40573765, 1.6, 2],
  ["pin3", -4.325112, -2.77408635, 1.4, 1.8],
] as const

const signalPins = [
  ["pin4", -1.75006],
  ["pin5", -1.249934],
  ["pin6", -0.750062],
  ["pin7", -0.249936],
  ["pin8", 0.249936],
  ["pin9", 0.750062],
  ["pin10", 1.24968],
  ["pin11", 1.75006],
  ["pin12", -3.350006],
  ["pin13", -3.050032],
  ["pin14", -2.549906],
  ["pin15", -2.249932],
  ["pin16", 2.249932],
  ["pin17", 2.55016],
  ["pin18", 3.050032],
  ["pin19", 3.350006],
] as const

const silkscreenRoutes = [
  [
    { x: -4.468978, y: -1.675714 },
    { x: -4.468978, y: 0.187198 },
  ],
  [
    { x: 4.47101, y: -5.394096 },
    { x: -4.468978, y: -5.394096 },
    { x: -4.468978, y: -3.912794 },
  ],
  [
    { x: 4.47101, y: -1.67607 },
    { x: 4.47101, y: 0.187554 },
  ],
  [
    { x: 4.47101, y: -5.394096 },
    { x: 4.47101, y: -3.912438 },
  ],
]

export interface UsbTypeC018Props {
  name: string
  pcbX: number
  pcbY: number
  pcbRotation?: number
  children?: ReactNode
  cadPositionOffset?: { x?: number; y?: number; z?: number }
  cadRotationOffsetZ?: number
}

export const UsbTypeC018 = ({
  name,
  pcbX,
  pcbY,
  pcbRotation,
  children,
  cadPositionOffset,
  cadRotationOffsetZ,
}: UsbTypeC018Props) => {
  const rotationRad = ((pcbRotation ?? 0) * Math.PI) / 180

  return (
    <connector
      name={name}
      standard="usb_c"
      pinLabels={pinLabels}
      supplierPartNumbers={{ jlcpcb: ["C2927038"] }}
      manufacturerPartNumber="USB_TYPE_C_018"
      footprint={
        <footprint>
          <hole pcbX={-2.899918} pcbY={0.905612} diameter="0.75mm" />
          <hole pcbX={2.899918} pcbY={0.905612} diameter="0.75mm" />
          {shellPins.map(([pin, x, y, holeHeight, outerHeight]) => (
            <Fragment key={pin}>
              <platedhole
                portHints={[pin]}
                pcbX={x}
                pcbY={y}
                holeWidth="0.8mm"
                holeHeight={holeHeight}
                outerWidth="1.2mm"
                outerHeight={outerHeight}
                shape="pill"
              />
            </Fragment>
          ))}
          {signalPins.map(([pin, x]) => (
            <Fragment key={pin}>
              <smtpad
                portHints={[pin]}
                pcbX={x}
                pcbY={2.174088}
                width="0.3mm"
                height="1.3mm"
                shape="rect"
              />
            </Fragment>
          ))}
          {silkscreenRoutes.map((route, index) => (
            <Fragment key={index}>
              <silkscreenpath route={route} />
            </Fragment>
          ))}
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=2a4bc2358b36497d9ab2a66ab6419ba3&pn=C2927038",
        rotationOffset: {
          x: 0,
          y: 0,
          z: cadRotationOffsetZ ?? 180,
        },
        positionOffset: {
          x: Math.sin(rotationRad) * 2.3 + (cadPositionOffset?.x ?? 0),
          y: -Math.cos(rotationRad) * 2.3 + (cadPositionOffset?.y ?? 0),
          z: cadPositionOffset?.z ?? 0,
        },
      }}
      allowOffBoard
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    >
      {children ?? (
        <enclosure.cutoutaperture
          shape="pill"
          width="12mm"
          height="4mm"
          heightDimensionOffset="-0.2mm"
        />
      )}
    </connector>
  )
}
