import * as React from 'react'
import { Link, Navigate, useLocation, useNavigate, type Location } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthState } from '@/lib/auth'
import { roleHome } from '@/lib/roles'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { AuthError } from '@/components/AuthLayout'
import { BrandIcon, Wordmark } from '@/components/BrandLogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Login() {
  const { session, role, loading: authLoading } = useAuthState()
  const navigate = useNavigate()
  const location = useLocation()
  // Where to go after logging in: the page they were sent here from, or their
  // own home. Never back to "/" or "/login", which are this page (that loops).
  const requested = (location.state as { from?: Location } | null)?.from?.pathname
  const from = requested && requested !== '/' && requested !== '/login' ? requested : null

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!authLoading && session && role) {
    return <Navigate to={from ?? roleHome[role]} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setSubmitting(false)
      return
    }

    // The redirect above takes over once the profile (and role) has loaded.
    if (from) navigate(from, { replace: true })
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* Photo panel (desktop: left half, phone: short banner on top) */}
      <div className="relative h-44 overflow-hidden sm:h-56 lg:h-auto">
        <img
          src="/w3l-cohort.jpg"
          alt="Women of a Web3Ladies cohort together at an event"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 hidden p-10 text-white lg:block">
          <p className="text-sm font-medium text-lavender">Web3 × AI Venture Builder</p>
          <h2 className="mt-2 max-w-md text-3xl font-bold leading-tight">Builder Venture LMS</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Live classes, recordings, class notes, your project and your mentor’s feedback, all in one place.
          </p>
        </div>
      </div>

      {/* Login panel */}
      <div className="flex justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <BrandIcon className="size-9" />
            <Wordmark className="text-xl" />
          </div>
          <h1 className="mt-8 text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in to the Builder Venture learning hub.</p>
          <div className="mt-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@web3ladies.com"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && <AuthError>{error}</AuthError>}
            <Button type="submit" disabled={submitting} className="w-full rounded-full">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
