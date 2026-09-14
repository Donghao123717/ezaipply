"use client"
import { useState } from 'react'
import { Check, FileText, Loader2, Sparkles } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { cn } from '@/lib/utils'

/** Small non-interactive mockups of the real product surfaces. */
function StagePreview({ kind, t }: { kind: string; t: LandingCopy['how']['preview'] }) {
  if (kind === 'documents') {
    return (
      <div className="space-y-2">
        {[
          { name: 'transcript_2026.pdf', size: '2.1 MB', pct: 100 },
          { name: 'activities_list.docx', size: '156 KB', pct: 100 },
          { name: 'awards_recognition.pdf', size: '480 KB', pct: 64 },
        ].map((file, i) => (
          <div key={file.name} className="rounded-lg border bg-background px-3 py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-primary truncate flex-1">{file.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{file.size}</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', file.pct === 100 ? 'bg-emerald-500' : 'bg-accent')}
                style={{ width: `${file.pct}%`, transitionDelay: `${i * 100}ms` }}
              />
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground pt-1">{t.fileTypes}</p>
      </div>
    )
  }

  if (kind === 'counselor') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground ml-6">
          {t.counselorAsk}
        </div>
        <div className="rounded-lg border bg-background px-3 py-2 space-y-1.5">
          {t.steps.map((label, i) => {
            const step = { label, state: i < 2 ? 'done' : 'live' }
            return (
            <div key={step.label} className="flex items-center gap-2 text-[11px]">
              {step.state === 'done' ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="h-3 w-3 text-accent shrink-0 animate-spin motion-reduce:animate-none" />
              )}
              <span className={step.state === 'done' ? 'text-muted-foreground' : 'text-primary'}>
                {step.label}
              </span>
            </div>
            )
          })}
        </div>
        <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{t.confirmTitle}</p>
          <p className="text-xs text-primary mt-1">{t.confirmBody}</p>
          <div className="flex gap-2 mt-2">
            <span className="rounded border px-2 py-0.5 text-[10px] text-muted-foreground">{t.cancel}</span>
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{t.confirm}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">{t.confirmNote}</p>
      </div>
    )
  }

  if (kind === 'writing') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-[10px] text-muted-foreground">{t.imported}</p>
          <p className="text-xs text-primary mt-0.5">{t.importedTitle}</p>
        </div>
        <p className="text-[10px] text-muted-foreground">{t.matched}</p>
        {[
          { school: 'Rice', prompt: 'Why Us', state: t.stateReady },
          { school: 'UCLA', prompt: 'Community', state: t.stateReady },
          { school: 'Duke', prompt: 'Contribution', state: t.stateDrafting },
          { school: 'Northwestern', prompt: 'Why this major', state: t.stateDrafting },
          { school: 'Tufts', prompt: 'Let your life speak', state: t.stateQueued },
        ].map((row, i) => (
          <div
            key={row.school}
            style={{ animationDelay: `${i * 100}ms` }}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 animate-rise-in motion-reduce:animate-none"
          >
            <span className="text-xs text-primary flex-1 truncate">
              {row.school} · {row.prompt}
            </span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                row.state === t.stateReady
                  ? 'bg-emerald-100 text-emerald-700'
                  : row.state === t.stateDrafting
                    ? 'bg-accent/15 text-accent'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {row.state}
            </span>
            <span className="text-[9px] text-muted-foreground">{t.yourVoice}</span>
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'forms') {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.extensionLabel}</p>
        {[
          { label: t.formRows[0], done: 14, total: 14 },
          { label: t.formRows[1], done: 22, total: 22 },
          { label: t.formRows[2], done: 18, total: 22 },
          { label: t.formRows[3], done: 4, total: 5 },
        ].map((row) => (
          <div key={row.label} className="rounded-lg border bg-background px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-primary">{row.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.done} / {row.total}
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', row.done === row.total ? 'bg-emerald-500' : 'bg-accent')}
                style={{ width: `${(row.done / row.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-background px-3 py-3 text-center">
        <p className="font-display text-2xl text-primary tabular-nums">84%</p>
        <p className="text-[10px] text-muted-foreground">{t.chanceLabel}</p>
      </div>
      {[
        { school: 'MIT', pct: 12 },
        { school: 'Northwestern', pct: 38 },
        { school: 'Tufts', pct: 46 },
        { school: 'UC Davis', pct: 78 },
      ].map((row) => (
        <div key={row.school} className="flex items-center gap-2">
          <span className="text-xs text-primary w-28 truncate">{row.school}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/60" style={{ width: `${row.pct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{row.pct}%</span>
        </div>
      ))}
    </div>
  )
}

export function HowItWorks({ copy }: { copy: LandingCopy }) {
  const HOW = copy.how
  const [active, setActive] = useState(0)
  const stage = HOW.stages[active]

  return (
    <section id="how" className="bg-secondary/30 py-24 border-y">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-3">{HOW.eyebrow}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold">
            <span className="text-primary">{HOW.titleLead} </span>
            <span className="italic text-accent">{HOW.titleEmphasis}</span>
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">{HOW.blurb}</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 mt-12 items-start">
            {/* A hairline-ruled index rather than a stack of boxes: the active
                step is marked by scale and weight, not by a border. */}
            <ol className="divide-y border-y">
              {HOW.stages.map((s, i) => {
                const isActive = i === active
                return (
                  <li key={s.num}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      className="group flex w-full items-start gap-5 py-5 pr-2 text-left"
                    >
                      <span
                        className={cn(
                          'shrink-0 font-display italic tabular-nums transition-all duration-300',
                          isActive
                            ? 'text-2xl not-italic font-semibold text-primary'
                            : 'text-sm text-muted-foreground/50 group-hover:text-muted-foreground',
                        )}
                      >
                        {s.num}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                            isActive ? 'text-accent' : 'text-muted-foreground/60',
                          )}
                        >
                          {s.name}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block text-sm leading-snug transition-colors',
                            isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {s.summary}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            <div className="lg:sticky lg:top-24">
              {/* Framed as a browser window so the preview reads as the real product. */}
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
                  <span className="flex gap-1.5">
                    {['bg-red-400/70', 'bg-amber-400/70', 'bg-emerald-400/70'].map((dot) => (
                      <span key={dot} className={cn('h-2 w-2 rounded-full', dot)} />
                    ))}
                  </span>
                  <span className="flex-1 rounded bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground truncate text-center">
                    {stage.url}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-accent">
                    <Sparkles className="h-3 w-3" />
                    {HOW.previewLabel}
                  </span>
                </div>
                {/* Remount on change so the entry animations replay. */}
                <div key={stage.num} className="p-5 animate-rise-in motion-reduce:animate-none">
                  <StagePreview kind={stage.preview} t={HOW.preview} />
                </div>
              </div>

              <div className="mt-4 rounded-xl border-l-2 border-accent/50 bg-card/60 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {HOW.whatHappens}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{stage.detail}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
