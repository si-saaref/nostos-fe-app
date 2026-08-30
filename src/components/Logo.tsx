interface Props {
  /** Mark only — for the collapsed sidebar and the mobile bar. */
  markOnly?: boolean
  className?: string
}

/**
 * The mark is the product's own device: an enamel plate seen edge-on, with the
 * coloured rim that carries category on every row of the ledger. The opening in
 * the ring is the return — nostos, the homecoming — closing back on itself.
 *
 * Drawn with tokens, so it re-colours with the theme like everything else.
 */
export const Logo = ({ markOnly = false, className = '' }: Props) => (
  <span className={`flex items-center gap-2.5 ${className}`}>
    <svg
      viewBox="0 0 28 28"
      width="26"
      height="26"
      role="img"
      aria-label="NOSTOS"
      className="shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="26"
        height="26"
        rx="8"
        fill="var(--card)"
        stroke="var(--hair)"
        strokeWidth="1"
      />
      {/* The rim — the same 3px edge every plate in the ledger carries. */}
      <path
        d="M9 1h-1a7 7 0 0 0-7 7v12a7 7 0 0 0 7 7h1z"
        fill="var(--accent)"
      />
      {/* The return: an arc that comes back to its own start. */}
      <path
        d="M18.6 9.6a5.4 5.4 0 1 0 1.9 4.1"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="9.4" r="2" fill="var(--accent)" />
    </svg>

    {!markOnly && (
      <span className="font-display text-ink text-[15px] leading-none font-bold tracking-[0.16em]">
        NOSTOS
      </span>
    )}
  </span>
)
