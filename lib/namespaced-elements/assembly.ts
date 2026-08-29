import type {
  AssemblyBoltPropsInput,
  AssemblyCablePropsInput,
  AssemblyDevicePropsInput,
  AssemblyScreenPropsInput,
  AssemblyScrewPropsInput,
  AssemblySubassemblyPropsInput,
} from "@tscircuit/props"
import type { ReactNode } from "react"
import { createNamespacedElement } from "./create-namespaced-element"

export interface AssemblyDeviceJsxProps extends AssemblyDevicePropsInput {
  children?: ReactNode
}

/** A screen is a device, so it nests like one. */
export interface AssemblyScreenJsxProps extends AssemblyScreenPropsInput {
  children?: ReactNode
}

export interface AssemblySubassemblyJsxProps
  extends AssemblySubassemblyPropsInput {}
export type AssemblyCadAssemblyJsxProps = AssemblySubassemblyJsxProps

export const assembly = {
  subassembly: createNamespacedElement<AssemblySubassemblyJsxProps>(
    "assembly.subassembly",
  ),
  cadassembly: createNamespacedElement<AssemblySubassemblyJsxProps>(
    "assembly.cadassembly",
  ),
  bolt: createNamespacedElement<AssemblyBoltPropsInput>("assembly.bolt"),
  cable: createNamespacedElement<AssemblyCablePropsInput>("assembly.cable"),
  device: createNamespacedElement<AssemblyDeviceJsxProps>("assembly.device"),
  screen: createNamespacedElement<AssemblyScreenJsxProps>("assembly.screen"),
  screw: createNamespacedElement<AssemblyScrewPropsInput>("assembly.screw"),
} as const
