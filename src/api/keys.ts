/**
 * Query-key root.
 *
 * Every household-scoped key extends `householdKey`, so one call can drop a
 * whole tenant's cache — on sign-out, or when a household switcher ships —
 * without each entity having to be enumerated.
 *
 * The rule this exists to enforce: one endpoint, one key, one response type.
 * Two hooks reading the same URL under different keys is how a mutation ends up
 * invalidating a cache nobody reads.
 */
export const householdKey = (householdId: string) => ['h', householdId] as const

export const entityKey = (householdId: string, entity: string) =>
  [...householdKey(householdId), entity] as const
