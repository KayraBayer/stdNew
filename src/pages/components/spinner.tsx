import React from "react";

type SpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

export default function Spinner({
  size = 24,
  label,
  className = "",
}: SpinnerProps): React.ReactElement {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="animate-spin"
        aria-label={label || "Yükleniyor"}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          opacity="0.25"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
