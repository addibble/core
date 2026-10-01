import type { AssemblyScreen } from "./AssemblyScreen"
import { isValidElement } from "react"
import { renderAssemblyCadModel } from "./render-assembly-cad-model"
import { resolveAssemblyPlacement } from "./resolve-assembly-placement"
import { resolveAssemblyModel } from "./resolve-assembly-model"

const formatMillimetersForModelprinter = (millimeters: number): string =>
  Number(millimeters.toFixed(6)).toString()

const getDefaultFlexScreenModel = (component: AssemblyScreen): string => {
  const { width, height } = component._parsedProps
  if (width === undefined || height === undefined) {
    throw new Error(
      `assembly.screen "${component.name}" requires both width and height when cadModel is omitted`,
    )
  }
  return `flexscreen_w${formatMillimetersForModelprinter(width)}mm_h${formatMillimetersForModelprinter(height)}mm`
}

export const AssemblyScreen_doInitialCadModelRender = (
  component: AssemblyScreen,
): void => {
  if (
    !component.root ||
    component.root.pcbDisabled ||
    !component.source_component_id
  )
    return
  const placement = resolveAssemblyPlacement(component)
  const model =
    resolveAssemblyModel(component._parsedProps) ??
    component._parsedProps.cadModel ??
    getDefaultFlexScreenModel(component)
  if (isValidElement(model)) {
    throw new Error("assembly.screen cadModel does not accept React elements")
  }
  const renderableModel = model as Parameters<typeof renderAssemblyCadModel>[1]
  component.cad_component_id = renderAssemblyCadModel(
    component,
    renderableModel,
    placement,
  )
}
