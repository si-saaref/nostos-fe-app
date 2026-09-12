import { Navigate, useLocation } from 'react-router-dom'

/**
 * A path that moved, with everything after it kept.
 *
 * `<Navigate to="/expenses">` alone would drop the query string, and on these
 * two routes the query string *is* the view — the month, the category, the
 * search. A bookmarked September-groceries link would land on today's
 * unfiltered month and look like the filters had been forgotten.
 *
 * `replace`, so the old path does not sit in history waiting for a Back press
 * to bounce off it again.
 */
export const LegacyRedirect = ({ to }: { to: string }) => {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}
