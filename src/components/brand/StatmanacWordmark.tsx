/** Logo-style wordmark: Stat (white) + manac (emerald) + gold underline */
export default function StatmanacWordmark({
  className = "",
  size = "hero",
}: {
  className?: string;
  size?: "hero" | "lg" | "md";
}) {
  const textClass =
    size === "hero"
      ? "font-black tracking-tight"
      : size === "lg"
        ? "text-2xl font-bold tracking-tight sm:text-3xl"
        : "text-xl font-bold tracking-tight";

  return (
    <span className={`inline-block ${className}`}>
      <span className={textClass}>
        <span className="text-foreground">Stat</span>
        <span className="text-accent">manac</span>
      </span>
      <span
        className="mt-1.5 block h-0.5 rounded-full bg-gold sm:mt-2"
        aria-hidden
      />
    </span>
  );
}
