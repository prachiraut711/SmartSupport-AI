import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Ticket,
  CircleDot,
  Clock,
  CheckCircle2,
  Archive,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Inbox,
  Calendar,
  Tag,
  LogIn,
  Users,
  Terminal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getAgentDashboard } from "@/services/agentDashboardService"
import { ApiError } from "@/services/api"
import type {
  AgentDashboardStats,
  AgentDashboardTicket,
} from "@/types/agent-dashboard"
import {
  StatusBadge,
  PriorityBadge,
  AssignmentBadge,
} from "@/components/tickets/TicketBadges"
import { formatCategory, formatDate } from "@/utils/formatters"

interface StatItem {
  key: keyof AgentDashboardStats
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
    iconColor: "text-indigo-700",
    borderAccent: "group-hover:border-indigo-300",
  },
  {
    key: "openTickets",
    label: "Open Queue",
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
    label: "Waiting on Cust.",
    icon: Clock,
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
  {
    key: "assignedTickets",
    label: "Assigned",
    icon: UserCheck,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-700",
    borderAccent: "group-hover:border-indigo-300",
  },
  {
    key: "unassignedTickets",
    label: "Unassigned",
    icon: UserX,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    borderAccent: "group-hover:border-rose-300",
  },
]

export default function AgentDashboardPage() {
  const navigate = useNavigate()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["agent-dashboard"],
    queryFn: getAgentDashboard,
  })

  const isAuthError =
    error instanceof ApiError && (error.status === 401 || error.status === 403)

  return (
    <div className="w-full space-y-8">
      {/* Header section with Operations Console accent */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Support Queue
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200/80 shadow-2xs">
              <Terminal className="size-3 text-violet-600" />
              <span>Agent Console</span>
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Global ticket queue overview, triage routing, and operational status.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>Refresh Queue</span>
          </Button>
        </div>
      </div>

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
                {isAuthError
                  ? "Agent Authentication Required"
                  : "Unable to load agent dashboard"}
              </h3>
              <p className="text-sm text-rose-700">
                {isAuthError
                  ? "Please sign in with an authorized agent account to view the support queue."
                  : error instanceof Error
                  ? error.message
                  : "Unable to load the agent dashboard. Please try again."}
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

      {/* 8 Statistics Cards with distinct AI console palette */}
      <section aria-label="Support Statistics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="size-7 rounded-lg" />
                  </div>
                  <Skeleton className="h-7 w-12" />
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

      {/* Recent Tickets Queue */}
      <section aria-label="Incoming Support Queue" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Active Queue
            </h2>
            <p className="text-xs text-slate-500">
              Latest incoming tickets across all customer accounts
            </p>
          </div>
          {data?.recentTickets && data.recentTickets.length > 0 && (
            <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              {data.recentTickets.length} ticket
              {data.recentTickets.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {Array.from({ length: 5 }).map((_, idx) => (
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
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!data?.recentTickets || data.recentTickets.length === 0) && (
          <div className="bg-white rounded-2xl border border-dashed border-violet-200/80 p-8 sm:p-14 text-center space-y-3 shadow-2xs">
            <div className="mx-auto size-12 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shadow-xs">
              <Inbox className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No tickets in the queue
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              All caught up! When customers submit support requests, they will appear here in the queue for triage and resolution.
            </p>
          </div>
        )}

        {/* Queue List with hover accent */}
        {!isLoading && !isError && data?.recentTickets && data.recentTickets.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {data.recentTickets.map((ticket: AgentDashboardTicket) => (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    navigate(`/agent/tickets/${ticket.id}`)
                  }
                }}
                className="group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-violet-50/20 hover:border-l-4 hover:border-l-violet-600 transition-all cursor-pointer focus:outline-none focus:bg-violet-50/30"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
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
                    {ticket.customerId && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Users className="size-3 text-slate-400" />
                          Customer: {ticket.customerId.slice(0, 8)}...
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignmentBadge isAssigned={ticket.agentId !== null} />
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="text-slate-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all">
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
