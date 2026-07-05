import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  className?: string;
};

export function StatChip({ label, value, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2",
        "transition-colors hover:bg-muted/70",
        className
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono text-sm font-semibold tabular-nums text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}
