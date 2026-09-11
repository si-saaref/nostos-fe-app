/**
 * What this deployment's API can do beyond the shipped contract.
 *
 * `meta.summary` needs no flag — its presence in a response *is* the signal,
 * and the pages read it that way. A write field cannot work like that: there
 * is nothing in a GET to tell us whether a POST would keep a `description`,
 * and a form that collects one the server drops loses the member's typing in
 * silence. So it is a flag, flipped in one place the day the column lands.
 *
 * Specified in `notes/FE-App/API-CHANGES-2026-09-10.md` §1.
 */
export const API_CAPABILITIES = {
  /** `description` on expense and income: create, update and read. */
  entryDescription: true,
} as const
