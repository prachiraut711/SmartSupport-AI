import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { register, login } from "@/services/authService"
import { ApiError } from "@/services/api"
import {
  AlertCircle,
  Loader2,
  UserPlus,
  CheckCircle2,
  User,
  Headphones,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<"CUSTOMER" | "AGENT">("CUSTOMER")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Full name is required.")
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Email address is required.")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.")
      return
    }

    if (!password || password.trim().length === 0) {
      setError("Password is required.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
      })

      setSuccess(true)

      // Automatically sign in the user for seamless onboarding
      try {
        const loginRes = await login({
          email: trimmedEmail,
          password,
        })
        if (loginRes.user.role === "AGENT") {
          navigate("/agent")
        } else {
          navigate("/customer")
        }
      } catch {
        navigate("/login")
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Registration failed. Please verify your connection and try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[460px] bg-white rounded-2xl border border-slate-200/90 shadow-[0_10px_30px_-5px_rgba(79,70,229,0.08)] p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
          <Sparkles className="size-3 text-indigo-600" />
          <span>New Account</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Create an account
        </h1>
        <p className="text-sm text-slate-500">
          Get started with SmartSupport AI in seconds
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="flex-1 font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in duration-150"
        >
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">Account created successfully! Signing in...</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              placeholder="Jane Doe"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              placeholder="jane@example.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Password
            </label>
            <span className="text-[11px] text-slate-400">Min. 6 characters</span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Role Selection (Distinctive AI SaaS segmented cards) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Account Role
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Customer Role Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setRole("CUSTOMER")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setRole("CUSTOMER")
                }
              }}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                role === "CUSTOMER"
                  ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`p-1.5 rounded-lg ${role === "CUSTOMER" ? "bg-indigo-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600"}`}>
                  <User className="size-3.5" />
                </div>
                {role === "CUSTOMER" && (
                  <span className="size-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Customer</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Submit &amp; track tickets</p>
              </div>
            </div>

            {/* Agent Role Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setRole("AGENT")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setRole("AGENT")
                }
              }}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                role === "AGENT"
                  ? "border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`p-1.5 rounded-lg ${role === "AGENT" ? "bg-violet-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600"}`}>
                  <Headphones className="size-3.5" />
                </div>
                {role === "AGENT" && (
                  <span className="size-2 rounded-full bg-violet-600" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Support Agent</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Triage &amp; resolve tickets</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-10.5 rounded-xl mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold shadow-md shadow-indigo-500/25 transition-all"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              <span>Create Account</span>
            </>
          )}
        </Button>
      </form>

      {/* Footer Navigation */}
      <div className="border-t border-slate-100 pt-5 text-center text-xs text-slate-500 space-y-2.5">
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Sign in
          </Link>
        </p>
        <p>
          <Link
            to="/"
            className="text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center gap-1"
          >
            <span>&larr; Back to overview</span>
          </Link>
        </p>
      </div>
    </div>
  )
}
