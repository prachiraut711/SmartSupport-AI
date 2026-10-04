import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Ticket,
  CircleDot,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Inbox,
  Calendar,
  Tag,
  LogIn,
  Plus,
  Loader2,
  X,
  FileText,
  UserCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCustomerDashboard } from "@/services/dashboardService"
import { createTicket } from "@/services/ticketService"
import { getCurrentUser } from "@/services/authService"
import { ApiError } from "@/services/api"
import type {
  CustomerDashboardStats,
  CustomerDashboardTicket,
} from "@/types/dashboard"
import {
  StatusBadge,
  PriorityBadge,
} from "@/components/tickets/TicketBadges"
import { formatCategory, formatDate } from "@/utils/formatters"

interface StatItem {
  key: keyof CustomerDashboardStats
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  borderAccent: string
}

const STATS_CONFIG: StatItem[] = [
  {
    key: "totalTickets",
    label: "Total Tickets",
    icon: Ticket,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    borderAccent: "group-hover:border-indigo-300",
  },
  {
    key: "openTickets",
    label: "Open",
    icon: CircleDot,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    borderAccent: "group-hover:border-blue-300",
  },
  {
    key: "inProgressTickets",
    label: "In Progress",
    icon: Clock,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    borderAccent: "group-hover:border-violet-300",
  },
  {
    key: "waitingForCustomerTickets",
    label: "Waiting on You",
    icon: UserCheck,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    borderAccent: "group-hover:border-amber-300",
  },
  {
    key: "resolvedTickets",
    label: "Resolved",
    icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    borderAccent: "group-hover:border-emerald-300",
  },
  {
    key: "closedTickets",
    label: "Closed",
    icon: Archive,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    borderAccent: "group-hover:border-slate-300",
  },
]

export default function CustomerDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = getCurrentUser()

  // Creation form states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: getCustomerDashboard,
  })

  const createTicketMutation = useMutation({
    mutationFn: (ticketData: { title: string; description: string }) =>
      createTicket(ticketData),
    onSuccess: (newTicket) => {
      setTitle("")
      setDescription("")
      setFormError(null)
      setIsCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ["customer-dashboard"] })
      navigate(`/tickets/${newTicket.id}`)
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setFormError(err.message)
      } else {
        setFormError("Failed to create ticket. Please try again.")
      }
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()

    if (!trimmedTitle) {
      setFormError("Ticket title is required.")
      return
    }

    if (trimmedTitle.length > 255) {
      setFormError("Ticket title must be 255 characters or fewer.")
      return
    }

    if (!trimmedDescription) {
      setFormError("Ticket description is required.")
      return
    }

    if (trimmedDescription.length > 10000) {
      setFormError("Ticket description must be 10,000 characters or fewer.")
      return
    }

    createTicketMutation.mutate({
      title: trimmedTitle,
      description: trimmedDescription,
    })
  }

  const isAuthError =
    error instanceof ApiError && (error.status === 401 || error.status === 403)

  return (
    <div className="w-full space-y-8">
      {/* Welcome Header with Indigo/Violet Accent */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back{currentUser?.name ? `, ${currentUser.name}` : ""} 👋
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
              <Sparkles className="size-3 text-indigo-600" />
              <span>AI Support Desk</span>
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Track your support requests and monitor ticket progress in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setIsCreateOpen(!isCreateOpen)
              setFormError(null)
            }}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/25 transition-all"
          >
            {isCreateOpen ? (
              <>
                <X className="size-4" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus className="size-4" />
                <span>New Ticket</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Ticket Creation Card / Form */}
      {isCreateOpen && (
        <div className="bg-white rounded-2xl border border-indigo-200/80 p-5 sm:p-7 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.06)] space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
                <FileText className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Submit a New Support Ticket
                </h2>
                <p className="text-xs text-slate-400">
                  Our team and AI triage will review your request promptly
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Close new ticket form"
            >
              <X className="size-4" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 flex items-start gap-2.5"
            >
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ticket-title"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Ticket Subject / Title
                </label>
                <span className="text-[11px] text-slate-400">
                  {title.length} / 255
                </span>
              </div>
              <input
                id="ticket-title"
                type="text"
                required
                maxLength={255}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (formError) setFormError(null)
                }}
                disabled={createTicketMutation.isPending}
                placeholder="Brief summary of the issue (e.g. Cannot download monthly invoice)"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ticket-desc"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Description
                </label>
                <span className="text-[11px] text-slate-400">
                  {description.length} / 10,000
                </span>
              </div>
              <textarea
                id="ticket-desc"
                rows={4}
                required
                maxLength={10000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (formError) setFormError(null)
                }}
                disabled={createTicketMutation.isPending}
                placeholder="Provide detailed information regarding the problem, error messages, or inquiry..."
                className="w-full p-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={createTicketMutation.isPending}
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createTicketMutation.isPending || !title.trim() || !description.trim()}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
              >
                {createTicketMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Creating Ticket...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Create Ticket</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-rose-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-sm text-rose-900">
                {isAuthError ? "Authentication Required" : "Unable to load dashboard"}
              </h3>
              <p className="text-sm text-rose-700">
                {isAuthError
                  ? "Please sign in to your customer account to view your support dashboard."
                  : error instanceof Error
                  ? error.message
                  : "Unable to load your dashboard. Please try again."}
              </p>
              <div className="pt-2 flex items-center gap-3">
                {isAuthError ? (
                  <Button
                    size="sm"
                    onClick={() => navigate("/login")}
                    className="rounded-xl flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <LogIn className="size-3.5" />
                    <span>Go to Login</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="rounded-xl border-rose-300 text-rose-900 hover:bg-rose-100"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6 Distinct AI-themed Statistics Cards */}
      <section aria-label="Support Statistics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="size-7 rounded-lg" />
                  </div>
                  <Skeleton className="h-7 w-10" />
                </div>
              ))
            : STATS_CONFIG.map(({ key, label, icon: Icon, iconBg, iconColor, borderAccent }) => {
                const count = data?.stats?.[key] ?? 0
                return (
                  <div
                    key={key}
                    className={`group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all ${borderAccent}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 truncate">
                        {label}
                      </span>
                      <div className={`p-1.5 rounded-xl ${iconBg} ${iconColor} border border-transparent shadow-2xs`}>
                        <Icon className="size-3.5" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                      {count}
                    </div>
                  </div>
                )
              })}
        </div>
      </section>

      {/* Recent Tickets Section */}
      <section aria-label="Recent Support Tickets" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Recent Tickets
            </h2>
            <p className="text-xs text-slate-500">
              Your most recent inquiries and real-time status updates
            </p>
          </div>
          {data?.recentTickets && data.recentTickets.length > 0 && (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              {data.recentTickets.length} ticket
              {data.recentTickets.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4 max-w-md" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!data?.recentTickets || data.recentTickets.length === 0) && (
          <div className="bg-white rounded-2xl border border-dashed border-indigo-200/80 p-8 sm:p-14 text-center space-y-4 shadow-2xs">
            <div className="mx-auto size-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs">
              <Inbox className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                No tickets yet
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                You haven&apos;t created any support tickets. Submit your first ticket to get help from our support team.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold flex items-center gap-1.5 mx-auto shadow-sm shadow-indigo-500/20"
            >
              <Plus className="size-4" />
              <span>Create Your First Ticket</span>
            </Button>
          </div>
        )}

        {/* Ticket List with subtle active hover accent */}
        {!isLoading && !isError && data?.recentTickets && data.recentTickets.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {data.recentTickets.map((ticket: CustomerDashboardTicket) => (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    navigate(`/tickets/${ticket.id}`)
                  }
                }}
                className="group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-indigo-50/20 hover:border-l-4 hover:border-l-indigo-600 transition-all cursor-pointer focus:outline-none focus:bg-indigo-50/30"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {ticket.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100/70 border border-slate-200/60 px-2 py-0.5 rounded-md">
                      <Tag className="size-3 text-indigo-500" />
                      {formatCategory(ticket.category)}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Calendar className="size-3 text-slate-400" />
                      Created {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">
                    <ArrowRight className="size-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
