"use client";

interface KTLogoProps {
  size?: number;
  glow?: boolean;
}

/** KT brand mark — a soft glowing orb with the KT wordmark. */
export default function KTLogo({ size = 96, glow = true }: KTLogoProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/40 to-sky-400/40 blur-2xl animate-pulse-soft"
        />
      )}
      <div
        className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 shadow-lg shadow-violet-500/25"
        style={{ width: size, height: size }}
      >
        <span
          className="font-bold tracking-tight text-white select-none"
          style={{ fontSize: size * 0.34 }}
        >
          KT
        </span>
      </div>
    </div>
  );
}
