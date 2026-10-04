import { useState } from "react"
import { Outlet, Link, useNavigate } from "react-router-dom"
import { Sparkles, LogOut, ShieldCheck, Menu, X, Terminal } from "lucide-react"
import { getCurrentUser, logout } from "@/services/authService"
import { Button } from "@/components/ui/button"

const CURRENT_YEAR = new Date().getFullYear()

export default function AgentLayout() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = () => {
    logout()
    navigate("/login")
  }

  // Get user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "AG"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-[#F1F5FF] flex flex-col justify-between text-slate-900 relative">
      {/* Top Operations Console Ambient Line */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />

      {/* Deep Indigo Support Console Header */}
      <header className="border-b border-indigo-950 bg-[#1E1B4B] sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Workspace Indicator */}
          <div className="flex items-center gap-6">
            <Link
              to="/agent"
              className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity group"
            >
              <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                <Sparkles className="size-4 text-violet-200" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-base sm:text-lg text-white">
                  SmartSupport
                </span>
                <span className="font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-400 to-violet-400 text-white shadow-2xs">
                  AI
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-2 pl-4 border-l border-indigo-800/60">
              <Link
                to="/agent"
                className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white bg-indigo-900/90 border border-indigo-700/60 shadow-2xs transition-colors"
              >
                Support Queue
              </Link>
            </nav>
          </div>

          {/* Right User & Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Agent Workspace Console Badge */}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-900/60 text-violet-200 border border-violet-700/60 shadow-2xs">
              <ShieldCheck className="size-3.5 text-violet-300" />
              <span>Agent Workspace</span>
            </span>

            {/* Agent Profile Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-indigo-800/80 bg-indigo-950/60 shadow-2xs">
              <div className="size-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 text-slate-900 flex items-center justify-center text-xs font-extrabold shadow-2xs">
                {getInitials(user?.name)}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-none">
                  {user?.name || "Support Agent"}
                </p>
                <p className="text-[10px] text-violet-300 font-medium leading-none mt-1 truncate max-w-[120px]">
                  {user?.email || "agent@support"}
                </p>
              </div>
            </div>

            {/* Sign Out Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="h-9 px-3 rounded-xl border-indigo-800 bg-indigo-900/40 text-indigo-200 hover:text-white hover:bg-indigo-800/80 hover:border-indigo-700 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-2 rounded-xl border border-indigo-800 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-800"
            >
              {mobileMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-indigo-900 bg-[#1E1B4B] px-4 py-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-900/60 border border-indigo-800">
              <div className="size-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 text-slate-900 flex items-center justify-center text-xs font-bold">
                {getInitials(user?.name)}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{user?.name || "Support Agent"}</p>
                <p className="text-[11px] text-violet-300">{user?.email || "agent@support"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Link
                to="/agent"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-900/90 border border-indigo-700/60"
              >
                Support Queue
              </Link>
            </div>

            <div className="pt-2 border-t border-indigo-900">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-center flex items-center gap-2 text-rose-300 border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport with visibly soft lavender/blue workspace canvas */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Console Footer */}
      <footer className="border-t border-indigo-100/80 py-4 px-4 sm:px-8 text-xs text-slate-500 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="size-3.5 text-indigo-600" />
            <span>SmartSupport AI &copy; {CURRENT_YEAR} — Operations &amp; Triage Console</span>
          </div>
          <div className="flex items-center gap-1.5 text-violet-600 font-medium">
            <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
            <span>Triage Engine Active</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
