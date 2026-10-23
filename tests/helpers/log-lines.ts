/** The JSON log lines a `console.log`/`console.error` spy received. */
export function logLines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}
