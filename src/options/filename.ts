// Characters Windows doesn't allow in a file name, plus control characters.
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/;
const ILLEGAL_ALL = new RegExp(ILLEGAL.source, "g");
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

export const MAX_NAME_LENGTH = 150;
export const ILLEGAL_HINT = `< > : " / \\ | ? *`;

export const isIllegalChar = (char: string) => ILLEGAL.test(char);

// Turns any text (a video title, or what the user typed) into a safe file name without the extension.
export function sanitizeFilename(name: string): string {
  const clean = name.replace(ILLEGAL_ALL, "_").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  if (clean === "") return "video";
  const capped = clean.slice(0, MAX_NAME_LENGTH).trimEnd();
  return RESERVED.test(capped) ? `${capped}_` : capped;
}
