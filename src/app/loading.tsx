export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-emerald-500" />
        <p className="text-xs text-muted-foreground">Chargement…</p>
      </div>
    </div>
  );
}
