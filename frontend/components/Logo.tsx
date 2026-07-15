"use client";

/**
 * Bauhaus mark — a square tile split by a diagonal (yellow / blue) with a red
 * circle over it: the movement's three primaries and its square-vs-circle
 * tension, in miniature. Stroke uses currentColor so it reads as ink in light
 * mode and paper in dark mode.
 */
export default function Logo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* yellow tile */}
      <rect x="1.5" y="1.5" width="37" height="37" fill="#f6c019" />
      {/* blue lower-right triangle */}
      <path d="M38.5 1.5 V38.5 H1.5 Z" fill="#144eb8" />
      {/* red circle */}
      <circle cx="20" cy="20" r="7.5" fill="#e63329" />
      {/* ink keyline */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
