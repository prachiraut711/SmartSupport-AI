import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, ShieldCheck, MessageSquare, Headphones, Zap, CornerDownLeft } from "lucide-react"

const CURRENT_YEAR = new Date().getFullYear()

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-slate-900 relative overflow-hidden">
      {/* Top Ambient Gradient Accent Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-electric-blue" />

      {/* Subtle Ambient Indigo/Violet Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-100/60 via-violet-100/30 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-center shadow-xs shadow-indigo-500/20">
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
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
              className="rounded-xl border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 shadow-2xs"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/register")}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-sm shadow-indigo-500/25"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-4xl text-center space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
            <Sparkles className="size-3.5 text-indigo-600" />
            <span>✦ AI-Powered Support Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Customer support, <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-electric-blue bg-clip-text text-transparent">
              powered by intelligence.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Resolve customer issues faster with intelligent Gemini AI ticket analysis, automated sentiment detection, and unified workflows for customers and support agents.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="w-full sm:w-auto h-11 px-7 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25"
            >
              <span>Get Started Free</span>
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto h-11 px-6 rounded-xl border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 shadow-2xs"
            >
              Sign In to Account
            </Button>
          </div>

          {/* AI Ticket Analysis Interactive Mockup Card */}
          <div className="w-full max-w-xl mx-auto pt-6 text-left">
            <div className="bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/70 rounded-2xl border border-violet-200/90 shadow-md shadow-violet-500/10 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-violet-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-2xs">
                    <Sparkles className="size-3.5" />
                  </div>
                  <span className="font-extrabold text-sm text-violet-950">
                    ✦ AI Ticket Analysis
                  </span>
                </div>
                <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-0.5 rounded-full border border-violet-200/80">
                  Sentiment: Negative
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/90 p-2.5 rounded-xl border border-violet-100">
                  <span className="text-slate-400 block font-medium">Category</span>
                  <span className="font-bold text-slate-800">TECHNICAL</span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-violet-100">
                  <span className="text-slate-400 block font-medium">Priority</span>
                  <span className="font-bold text-rose-600">HIGH</span>
                </div>
              </div>

              <div className="text-xs bg-white/90 p-3 rounded-xl border border-violet-100 space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-slate-900 font-bold">Suggested AI Reply:</strong>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                    <CornerDownLeft className="size-3" />
                    <span>Auto-drafted</span>
                  </span>
                </div>
                <p className="text-slate-700 italic border-l-2 border-violet-400 pl-2.5">
                  &ldquo;Hello, I would be happy to help resolve this technical error right away. Could you please confirm your browser version?&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2 hover:border-indigo-200 transition-colors">
              <div className="size-8 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center">
                <Zap className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Gemini AI Engine</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated sentiment detection, ticket summaries, and suggested responses.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2 hover:border-indigo-200 transition-colors">
              <div className="size-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
                <Headphones className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Agent Workspace</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dedicated support queue with quick status updates, ticket assignment, and live triage.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2 hover:border-indigo-200 transition-colors">
              <div className="size-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <MessageSquare className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Customer Portal</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Self-service ticket tracking, direct agent messaging, and full conversation history.
              </p>
            </div>
          </div>

          {/* Quick links for interview reviewers */}
          <div className="border-t border-slate-200/80 pt-6 mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Portfolio &amp; Reviewer Quick Links
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/login")}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:text-indigo-600"
              >
                Login
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/register")}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:text-indigo-600"
              >
                Register
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/customer")}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:text-indigo-600"
              >
                Customer Portal
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/agent")}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:text-indigo-600"
              >
                Agent Workspace
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Modern SaaS Footer */}
      <footer className="border-t border-slate-200/80 py-4 px-4 sm:px-8 text-xs text-slate-400 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SmartSupport AI &copy; {CURRENT_YEAR} — Enterprise Support Intelligence</span>
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <ShieldCheck className="size-3.5" />
            <span>Secure Role-Based Access Control</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
