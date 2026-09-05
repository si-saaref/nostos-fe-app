/** ASCII-only in Phase 1 — punycode is explicitly deferred. */
export const isAsciiEmail = (email: string): boolean =>
  // eslint-disable-next-line no-control-regex
  /^[\x00-\x7F]+$/.test(email) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
