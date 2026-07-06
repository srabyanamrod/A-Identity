type LogoProps = {
  /** Square edge length in px. Defaults to 32. */
  size?: number
  /** Fill color for the mark. Defaults to the brand ink color. */
  fill?: string
  className?: string
}

/**
 * A-Identity mark, a geometric, angular interlock rendered on a 256 grid.
 * Scales crisply at any `size` since it is pure path geometry.
 */
export default function Logo({ size = 32, fill = '#192837', className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      overflow="visible"
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 64 128 L 64.5 128 L 32 95 L 0 64 L 0 0 L 64 0 L 128 64 L 128 64.5 L 161 32 L 192 0 L 256 0 L 256 64 L 192 128 L 128 128 L 128 192 L 96 223 L 63.5 256 L 0 256 L 0 192 Z M 256 192 L 224 223 L 191.5 256 L 128 256 L 128 192 L 192 128 L 256 128 Z"
        fill={fill}
      />
    </svg>
  )
}
