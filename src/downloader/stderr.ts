// yt-dlp prints failures on stderr as "ERROR: ..."; keep the last one.
export function lastErrorLine(stderr: string, fallback: string): string {
  const lines = stderr.split(/\r?\n/).filter((line) => line.startsWith("ERROR:"));
  const last = lines.at(-1);
  return last ? last.slice("ERROR:".length).trim() : fallback;
}
