import { Outlet, Link } from "react-router-dom"
import { Sparkles, ShieldCheck } from "lucide-react"

const CURRENT_YEAR = new Date().getFullYear()

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between relative overflow-hidden">
      {/* Subtle Ambient Indigo/Violet Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-indigo-100/50 via-violet-50/30 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-slate-900 hover:opacity-90 transition-opacity group"
          >
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-center shadow-xs shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="size-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-slate-900">
                SmartSupport
              </span>
              <span className="font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs">
                AI
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              <ShieldCheck className="size-3.5 text-indigo-600" />
              <span>Secure Authentication</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Form Viewport */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full flex justify-center">
          <Outlet />
        </div>
      </main>

      {/* Modern SaaS Footer */}
      <footer className="border-t border-slate-200/80 py-4 px-4 sm:px-8 text-xs text-slate-400 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SmartSupport AI &copy; {CURRENT_YEAR} — Enterprise Support Intelligence</span>
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Identity &amp; API Security Active</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
