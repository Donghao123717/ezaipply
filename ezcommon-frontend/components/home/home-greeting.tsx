"use client"
import { useT } from '@/lib/i18n/use-t'

function greetingKey() {
  const hour = new Date().getHours()
  if (hour < 12) return 'home.greetingMorning'
  if (hour < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

export function HomeGreeting({ firstName }: { firstName: string }) {
  const t = useT()
  return (
    <h1 className="font-display text-4xl sm:text-5xl font-semibold text-primary">
      {t(greetingKey())}, {firstName}.
    </h1>
  )
}
