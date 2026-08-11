export function NotesPage({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Anything else you&apos;d like this school to know?
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional - context on your application, special circumstances, or anything you couldn't fit elsewhere."
        className="w-full min-h-40 rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
      />
    </div>
  )
}
