"use client";

interface BaseballIconProps {
  className?: string;
}

export function BaseballIcon({ className = "h-4 w-4" }: BaseballIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Baseball ball */}
      <circle cx="12" cy="12" r="10" />
      {/* Left seam */}
      <path d="M7.5 4.5c1.5 2 2 4.5 2 7.5s-.5 5.5-2 7.5" />
      {/* Right seam */}
      <path d="M16.5 4.5c-1.5 2-2 4.5-2 7.5s.5 5.5 2 7.5" />
      {/* Stitch marks - left */}
      <path d="M8 6l1 1" />
      <path d="M7 9l1.5.5" />
      <path d="M7.5 12l1.5.5" />
      <path d="M8 15l1 1" />
      {/* Stitch marks - right */}
      <path d="M16 6l-1 1" />
      <path d="M17 9l-1.5.5" />
      <path d="M16.5 12l-1.5.5" />
      <path d="M16 15l-1 1" />
    </svg>
  );
}
