// snatch runs on Windows and macOS (package.json "os" keeps npm from installing it elsewhere),
// so "not a Mac" means Windows.
export const IS_MAC = process.platform === "darwin";
