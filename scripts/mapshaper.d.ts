declare module "mapshaper" {
  // Runs mapshaper commands and returns output files keyed by filename. Only
  // text formats are used here, so outputs are strings. `input` supplies
  // in-memory file contents that commands can read by name.
  function applyCommands(
    commands: string,
    input?: Record<string, string>,
  ): Promise<Partial<Record<string, string>>>

  const geo: { applyCommands: typeof applyCommands }
  export default geo
}
