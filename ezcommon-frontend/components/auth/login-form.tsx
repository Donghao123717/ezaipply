"use client"
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useT } from '@/lib/i18n/use-t'
import { APP_HOME } from '@/lib/app-routes'

const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email' }),
  password: z.string().min(6, { message: 'At least 6 characters' }),
  remember: z.boolean().optional().default(false),
  // loginType controls whether the user logs in as a student or as an organization
  loginType: z.enum(['student', 'org']).default('student'),
})

type LoginValues = z.infer<typeof LoginSchema>

const EmailOnlySchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email' }),
  displayName: z.string().max(200).optional(),
})

type EmailOnlyValues = z.infer<typeof EmailOnlySchema>

export function LoginForm() {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [usePassword, setUsePassword] = useState(false)
  // Sign-in drops the student into the app, not back onto the marketing page.
  const appBase = APP_HOME

  const emailForm = useForm<EmailOnlyValues>({
    resolver: zodResolver(EmailOnlySchema),
    defaultValues: { email: '', displayName: '' },
  })

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
      loginType: 'student',
    },
  })

  const loginType = form.watch('loginType')

  useEffect(() => {
    const saved = window.localStorage.getItem('remember_device')
    if (saved === 'true') {
      form.setValue('remember', true)
    }
  }, [form])

  const onEmailSubmit = useCallback(async (values: EmailOnlyValues) => {
    setError(null)
    setLoading(true)
    try {
      const res = await signIn('passwordless', {
        email: values.email,
        display_name: values.displayName || '',
        callbackUrl: appBase,
        redirect: false,
      })
      if (res?.error) {
        setError(t('auth.genericError'))
      } else {
        window.location.href = res?.url || appBase
      }
    } catch {
      setError(t('auth.genericError'))
    } finally {
      setLoading(false)
    }
  }, [appBase, t])

  const onSubmit = useCallback(async (values: LoginValues) => {
    setError(null)
    setLoading(true)
    try {
      window.localStorage.setItem('remember_device', values.remember ? 'true' : 'false')
      const res = await signIn('credentials', {
        email: values.email,
        password: values.password,
        remember: values.remember ? 'true' : 'false',
        login_type: values.loginType === 'org' ? 'org' : 'student',
        // Always send users to the app root (public URL); server-side will redirect based on role
        callbackUrl: appBase,
        redirect: false,
      })
      if (res?.error) {
        setError(res.error)
      } else if (res?.url) {
        window.location.href = res.url
      } else {
        window.location.href = appBase
      }
    } catch (e) {
      setError('Failed to sign in')
    } finally {
      setLoading(false)
    }
  }, [appBase])

  if (!usePassword) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.welcomeTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.welcomeSubtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="pl-email">{t('auth.emailLabel')}</Label>
            <Input
              id="pl-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              {...emailForm.register('email')}
            />
            {emailForm.formState.errors.email && (
              <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pl-name">
              {t('auth.nameLabel')}{' '}
              <span className="text-xs font-normal text-muted-foreground">({t('auth.nameOptional')})</span>
            </Label>
            <Input
              id="pl-name"
              type="text"
              autoComplete="name"
              placeholder={t('auth.namePlaceholder')}
              {...emailForm.register('displayName')}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('auth.continuing') : t('auth.continue')}
          </Button>

          <p className="text-xs text-muted-foreground">{t('auth.privacyNote')}</p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => { setError(null); setUsePassword(true) }}
              className="text-sm text-primary hover:underline"
            >
              {t('auth.passwordToggle')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.passwordTitle')}</h1>

      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label>{t('auth.loginAs')}</Label>
          <div className="inline-flex rounded-md border p-1 text-xs">
            <button
              type="button"
              onClick={() => form.setValue('loginType', 'student')}
              className={`flex-1 rounded-sm px-3 py-1 ${loginType === 'student' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
            >
              {t('auth.student')}
            </button>
            <button
              type="button"
              onClick={() => form.setValue('loginType', 'org')}
              className={`flex-1 rounded-sm px-3 py-1 ${loginType === 'org' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
            >
              {t('auth.organization')}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.emailLabel')}</Label>
          <Input id="email" type="email" placeholder={t('auth.emailPlaceholder')} {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.passwordLabel')}</Label>
          <Input id="password" type="password" placeholder="••••••••" {...form.register('password')} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.watch('remember')} onCheckedChange={(v) => form.setValue('remember', Boolean(v))} />
            {t('auth.rememberDevice')}
          </label>
          <Link href="#" className="text-sm text-primary hover:underline">{t('auth.forgotPassword')}</Link>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => { setError(null); setUsePassword(false) }}
            className="text-primary hover:underline"
          >
            {t('auth.passwordlessToggle')}
          </button>
          <span className="text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href="/auth/register" className="text-primary hover:underline">{t('auth.register')}</Link>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t('auth.orLoginWith')}</span>
          <Separator className="flex-1" />
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={() => signIn('google', { callbackUrl: APP_HOME })}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.7-2.6-5.7-5.7S8.9 6 12 6c1.8 0 3 .8 3.7 1.5l2.5-2.5C16.8 3.5 14.6 2.4 12 2.4 6.9 2.4 2.9 6.4 2.9 11.5S6.9 20.6 12 20.6c6 0 9.3-4.2 9.3-8.9 0-.6-.1-1-.1-1.5H12z" />
          </svg>
          {t('auth.continueWithGoogle')}
        </Button>
      </form>
    </div>
  )
}
