import type { ParsedCutoutApertureProps } from "@tscircuit/props"
import type { CutoutAperture } from "circuit-json"

export const underscorifyCutoutAperture = (
  aperture: ParsedCutoutApertureProps,
): CutoutAperture => ({
  shape: aperture.shape,
  width_mm: aperture.widthMm,
  height_mm: aperture.heightMm,
  diameter_mm: aperture.diameterMm,
  corner_radius_mm: aperture.cornerRadiusMm,
  flat_offset_mm: aperture.flatOffsetMm,
  z_center_above_board_mm: aperture.zCenterAboveBoardMm,
  margin_mm: aperture.marginMm,
})
