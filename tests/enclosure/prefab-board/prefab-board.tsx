import type {} from "lib"
import type { ReactNode } from "react"

export const boardWidthMm = 75
export const boardHeightMm = 55

export const PrefabBoard = ({ children }: { children?: ReactNode }) => (
  <board
    name="B1"
    width={`${boardWidthMm}mm`}
    height={`${boardHeightMm}mm`}
    thickness="1.4mm"
    borderRadius="2mm"
    routingDisabled
  >
    {children}
  </board>
)
