import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path
        d="M11 22c-1.6-1.8-1.6-3.7 0-5.5s1.6-3.7 0-5.5M16 22c-1.6-1.8-1.6-3.7 0-5.5s1.6-3.7 0-5.5M21 22c-1.6-1.8-1.6-3.7 0-5.5s1.6-3.7 0-5.5"
        fill="none"
        strokeWidth="1.9"
        strokeLinecap="round"
        className="stroke-background"
      />
    </svg>
  );
}

export function Logo({ name = "Квипекс", className }: { name?: string; tagline?: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[19px] font-semibold tracking-tight">{name}</span>
    </span>
  );
}
