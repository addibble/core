import { expect, spyOn, test } from "bun:test"
import { getReferencedEnclosureBoard } from "lib/components/primitive-components/get-referenced-enclosure-board"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("deferred enclosure DRC retains prior diagnostics and retries before swapping completed results", async () => {
  const { circuit } = await getMountingKeepoutFixture()
  const board = getReferencedEnclosureBoard(circuit.firstChild!, ".B1")
  const previous = [...board._generatedBoardDrcDiagnostics]
  expect(previous.length).toBeGreaterThan(0)
  board._enclosureDrcNeedsRefresh = true

  const pendingRouting = spyOn(
    board,
    "_hasIncompleteAsyncEffectsInSubtreeForPhase",
  ).mockImplementation((phase) => phase === "PcbTraceRender")
  try {
    board.updateEnclosurePcbDesignRuleChecks()
    expect(board._enclosureDrcNeedsRefresh).toBe(true)
    expect(board._drcChecksComplete).toBe(true)
    expect(board._generatedBoardDrcDiagnostics).toEqual(previous)
    expect(
      previous.every((diagnostic) => circuit.db.toArray().includes(diagnostic)),
    ).toBe(true)
  } finally {
    pendingRouting.mockRestore()
  }

  const hasTraces = spyOn(board, "_hasTracesToRoute").mockReturnValue(true)
  const childrenRouted = spyOn(
    board,
    "_areChildSubcircuitsRouted",
  ).mockReturnValue(false)
  try {
    expect(board.updatePcbDesignRuleChecks(true)).toBe(false)
    board.updateEnclosurePcbDesignRuleChecks()
    expect(board._enclosureDrcNeedsRefresh).toBe(true)
    expect(board._generatedBoardDrcDiagnostics).toEqual(previous)
    expect(
      previous.every((diagnostic) => circuit.db.toArray().includes(diagnostic)),
    ).toBe(true)
  } finally {
    hasTraces.mockRestore()
    childrenRouted.mockRestore()
  }

  board._currentRenderPhase = "EnclosurePcbDesignRuleChecks"
  board.updateEnclosurePcbDesignRuleChecks()
  expect(board._enclosureDrcNeedsRefresh).toBe(false)
  expect(board._drcChecksInProgress).toBe(true)
  expect(
    previous.every((diagnostic) => circuit.db.toArray().includes(diagnostic)),
  ).toBe(true)
  await circuit.renderUntilSettled()
  expect(board._drcChecksComplete).toBe(true)
  expect(
    previous.some((diagnostic) => circuit.db.toArray().includes(diagnostic)),
  ).toBe(false)
  expect(board._generatedBoardDrcDiagnostics.length).toBeGreaterThan(0)
})
