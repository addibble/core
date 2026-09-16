# @tscircuit/core

The core logic used to build Circuit JSON from tscircuit React elements.

[tscircuit](https://github.com/tscircuit/tscircuit) &middot; [Online Playground](https://tscircuit.com/editor) &middot; [Development Guide](./docs/DEVELOPMENT.md) &middot; [Core Benchmarks](https://core-benchmarks.tscircuit.com/) &middot; [Contributor Getting Started Video](https://share.cleanshot.com/rbJpnvJZ)

You can use `core` to create [Circuit JSON](https://github.com/tscircuit/circuit-json), which can then
be converted into Gerbers, viewed online, and much more.

## Usage

```tsx
import { Circuit } from "@tscircuit/core"

const circuit = new Circuit()

circuit.add(
  <board width="10mm" height="10mm">
    <resistor name="R1" resistance="10k" footprint="0402" />
    <led name="L1" footprint="0402" />

    <trace from="R1.pin1" to="net.VCC" />
    <trace from="R1.pin2" to="L1.pos" />
    <trace from="L1.neg" to="net.GND" />
  </board>
)

circuit.getCircuitJson()
```

## Enclosure mounting hardware

Mounts can be nested in their board hole or reference it with `holeRef`:

```tsx
import { assembly, enclosure } from "@tscircuit/core"

const device = (
  <assembly.device>
    <board name="B1" width="40mm" height="24mm">
      <hole name="H1" diameter="3.4mm">
        <enclosure.fdm.heatsetinsert thread="m3" />
      </hole>
    </board>
    <assembly.bolt thread="m3" holeRef=".B1 .H1" fastensLid lidColumn />
    <enclosure.fdm.box boardRef=".B1" standoffHeight="10mm" />
  </assembly.device>
)
```

Use `assembly.screw` without an insert for a self-tapping board mount.
For lid bolts, `lidColumn` prints a support column, `"spacer"` selects a
purchased spacer, and false or omission leaves the gap open. The solver
selects hardware from the authored thread, head and installation requirements;
each purchased piece receives source, synthetic PCB and CAD records.

After CAD rendering, actual bottom bosses and top columns/spacers produce
layer-specific circular PCB keepouts. `enclosure.fdm.box` accepts
`mountingKeepoutMargin` as a distance, defaulting to `0.5mm`; zero removes the
extra margin, not the support keepout. Component-footprint and copper DRC run
again against these outputs. Editing placement or retention and rendering
again replaces generated keepouts and stale diagnostics without automatically
moving components or restarting routing. Authored keepouts and diagnostics
are preserved. No external CAD model loading is needed for mounting clearance.

## Non-React Usage

```tsx
import { Board, Resistor, Led, Trace, Circuit } from "@tscircuit/core"

const circuit = new Circuit()

const board = new Board({
  width: "10mm",
  height: "10mm",
})
circuit.add(board)

const R1 = new Resistor({ resistance: "10k", footprint: "0402" })
const L1 = new Led({ footprint: "0402" })
board.add(R1)
board.add(L1)

const trace = new Trace({ width: "0.2mm" })
trace.connect(R1.output, L1.anode)
board.add(trace)

circuit.getCircuitJson() // [{ type: "board", ...}, { type: "resistor", ...}, ...]
```

## Development

- [How does core work?](./docs/DEVELOPMENT.md#overview-of-how-core-works)
- [How to do benchmarking or debug performance](./docs/DEVELOPMENT.md#debugging-performance)
