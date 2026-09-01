"use client";

interface VoiceButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  ariaLabel?: string;
}

const variants: Record<NonNullable<VoiceButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-r from-violet-500 to-sky-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.03]",
  secondary:
    "bg-white/10 text-white border border-white/15 hover:bg-white/20 hover:scale-[1.03]",
  danger:
    "bg-rose-500/90 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-500 hover:scale-[1.03]",
};

export default function VoiceButton({
  label,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  ariaLabel,
}: VoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={`rounded-full px-8 py-4 text-base font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]} ${className}`}
    >
      {label}
    </button>
  );
}
