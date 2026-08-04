import { Circuit } from "lib/RootCircuit"
import PrefabBoardCircuit from "./prefab-board.circuit"

export const renderPrefabBoardCircuitJson = async () => {
  const circuit = new Circuit()
  circuit.add(<PrefabBoardCircuit />)
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
