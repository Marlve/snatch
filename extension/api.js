// Firefox's promise-based API is `browser`; Chrome has no `browser`, but its `chrome` API
// returns promises too in Manifest V3. Everything else imports this instead of using either name.
export const api = globalThis.browser ?? globalThis.chrome;
