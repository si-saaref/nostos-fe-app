interface Props {
  /** What is being waited for. Announced, and shown under the arc. */
  label: string
  /** Fill the space the content will take, rather than a fixed band. */
  full?: boolean
}

/**
 * The app's one loading surface.
 *
 * Deliberately not a skeleton. A skeleton has to be drawn per surface to be
 * worth anything — get the geometry wrong and it is a grey mockup of the wrong
 * page — and this product would need four of them. One honest indicator that
 * says the same thing everywhere is the cheaper truth.
 *
 * Tokens only: the arc is `--accent`, the label is `--muted`. The version this
 * replaced hardcoded `text-gray-500`, which is how a loading state ends up
 * being the one element that ignores the theme.
 */
export const Loading = ({ label, full = false }: Props) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-2.5 p-8 ${
      full ? 'h-full min-h-56' : 'min-h-40'
    }`}
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="spinner text-accent"
    >
      {/* The track, then the arc riding it — a bare arc on the ground reads
          as a fragment rather than as something turning. */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.18"
      />
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="18 42"
      />
    </svg>
    <p className="text-muted text-[11.5px] font-semibold">{label}</p>
  </div>
)
