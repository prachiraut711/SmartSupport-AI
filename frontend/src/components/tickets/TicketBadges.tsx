import type { TicketStatus, TicketPriority } from "@/types/dashboard"
import { UserCheck, UserX, Clock, CheckCircle2, CircleDot, AlertCircle, Archive } from "lucide-react"

export function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case "OPEN":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
          <CircleDot className="size-3 text-blue-600 animate-pulse" />
          <span>Open</span>
        </span>
      )
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200/80 shadow-2xs">
          <Clock className="size-3 text-violet-600" />
          <span>In Progress</span>
        </span>
      )
    case "WAITING_FOR_CUSTOMER":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span>Waiting on You</span>
        </span>
      )
    case "RESOLVED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
          <CheckCircle2 className="size-3 text-emerald-600" />
          <span>Resolved</span>
        </span>
      )
    case "CLOSED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
          <Archive className="size-3 text-slate-400" />
          <span>Closed</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {status}
        </span>
      )
  }
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  switch (priority) {
    case "URGENT":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
          <AlertCircle className="size-3 text-rose-500" />
          <span>Urgent</span>
        </span>
      )
    case "HIGH":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200/80">
          <span className="size-1.5 rounded-full bg-orange-500" />
          <span>High</span>
        </span>
      )
    case "MEDIUM":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span>Medium</span>
        </span>
      )
    case "LOW":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80">
          <span className="size-1.5 rounded-full bg-sky-400" />
          <span>Low</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
          {priority}
        </span>
      )
  }
}

export function AssignmentBadge({ isAssigned }: { isAssigned: boolean }) {
  if (isAssigned) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
        <UserCheck className="size-3 text-indigo-600" />
        <span>Assigned</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
      <UserX className="size-3 text-slate-400" />
      <span>Unassigned</span>
    </span>
  )
}
