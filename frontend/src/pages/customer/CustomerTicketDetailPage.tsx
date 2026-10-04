import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  LogIn,
  MessageSquare,
  Copy,
  Check,
  Calendar,
  Tag,
  User,
  Headphones,
  CornerDownLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getTicketById,
  getTicketMessages,
  createTicketMessage,
  updateTicket,
  assignTicket,
  generateTicketAiAnalysis,
  getTicketAiAnalysis,
} from "@/services/ticketService"
import { getCurrentUser } from "@/services/authService"
import { ApiError } from "@/services/api"
import {
  StatusBadge,
  PriorityBadge,
  AssignmentBadge,
} from "@/components/tickets/TicketBadges"
import { formatCategory, formatDate } from "@/utils/formatters"
import type { TicketStatus } from "@/types/dashboard"

export default function CustomerTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = getCurrentUser()
  const isAgent = currentUser?.role === "AGENT"

  const [replyContent, setReplyContent] = useState("")
  const [replyError, setReplyError] = useState<string | null>(null)
  const [copiedReply, setCopiedReply] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // 1. Fetch ticket details
  const {
    data: ticket,
    isLoading: isTicketLoading,
    isError: isTicketError,
    error: ticketError,
    refetch: refetchTicket,
  } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => {
      if (!ticketId) throw new ApiError("Invalid ticket ID", 400)
      return getTicketById(ticketId)
    },
    enabled: Boolean(ticketId),
  })

  // 2. Fetch ticket messages
  const {
    data: messages,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: () => {
      if (!ticketId) throw new ApiError("Invalid ticket ID", 400)
      return getTicketMessages(ticketId)
    },
    enabled: Boolean(ticketId) && !isTicketError,
  })

  // 3. Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => {
      if (!ticketId) throw new Error("Ticket ID is required")
      return createTicketMessage(ticketId, content)
    },
    onSuccess: () => {
      setReplyContent("")
      setReplyError(null)
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] })
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setReplyError(err.message)
      } else {
        setReplyError("Failed to send message. Please try again.")
      }
    },
  })

  // 4. Update status mutation (Agent only)
  const updateStatusMutation = useMutation({
    mutationFn: (status: TicketStatus) => {
      if (!ticketId) throw new Error("Ticket ID is required")
      return updateTicket(ticketId, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["agent-dashboard"] })
    },
  })

  // 5. Assign ticket mutation (Agent only)
  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) => {
      if (!ticketId) throw new Error("Ticket ID is required")
      return assignTicket(ticketId, agentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["agent-dashboard"] })
    },
  })

  // 6. Fetch existing AI analysis if user is AGENT
  const {
    data: savedAiAnalysis,
  } = useQuery({
    queryKey: ["ticket-ai-analysis", ticketId],
    queryFn: () => {
      if (!ticketId) return null
      return getTicketAiAnalysis(ticketId)
    },
    enabled: Boolean(ticketId) && isAgent,
    retry: false,
  })

  // 7. Generate AI analysis mutation (Agent only)
  const aiMutation = useMutation({
    mutationFn: () => {
      if (!ticketId) throw new Error("Ticket ID is required")
      return generateTicketAiAnalysis(ticketId)
    },
    onSuccess: (data) => {
      setAiError(null)
      queryClient.setQueryData(["ticket-ai-analysis", ticketId], data)
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] })
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setAiError(err.message)
      } else {
        setAiError("AI analysis failed. Please try again shortly.")
      }
    },
  })

  const currentAiAnalysis = aiMutation.data || savedAiAnalysis

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    setReplyError(null)

    const trimmed = replyContent.trim()
    if (!trimmed) {
      setReplyError("Message content cannot be empty.")
      return
    }

    if (trimmed.length > 5000) {
      setReplyError("Message exceeds the 5,000 character limit.")
      return
    }

    sendMessageMutation.mutate(trimmed)
  }

  const handleCopySuggested = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedReply(true)
    setTimeout(() => setCopiedReply(false), 2000)
  }

  const handleApplySuggested = (text: string) => {
    setReplyContent(text)
    setCopiedReply(true)
    setTimeout(() => setCopiedReply(false), 2000)
  }

  const isAuthError =
    ticketError instanceof ApiError && (ticketError.status === 401 || ticketError.status === 403)
  const isNotFoundError =
    ticketError instanceof ApiError && ticketError.status === 404

  // Loading skeleton state
  if (isTicketLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-2xs">
          <Skeleton className="h-7 w-3/4 max-w-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-2xs">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state for ticket
  if (isTicketError) {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-4 shadow-md shadow-indigo-500/5 mx-auto my-auto">
        <div className="mx-auto size-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {isNotFoundError
            ? "Ticket Not Found"
            : isAuthError
            ? "Access Denied"
            : "Unable to Load Ticket"}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {isNotFoundError
            ? "The ticket you are looking for does not exist or you do not have permission to view it."
            : isAuthError
            ? "Please sign in with the appropriate account to view this ticket."
            : ticketError instanceof Error
            ? ticketError.message
            : "An unexpected error occurred while fetching ticket details."}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          {isAuthError ? (
            <Button onClick={() => navigate("/login")} className="rounded-xl flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
              <LogIn className="size-4" />
              <span>Go to Login</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(isAgent ? "/agent" : "/customer")}
                className="rounded-xl border-slate-200"
              >
                Back to {isAgent ? "Queue" : "Dashboard"}
              </Button>
              {!isNotFoundError && (
                <Button onClick={() => refetchTicket()} className="rounded-xl flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <RefreshCw className="size-3.5" />
                  <span>Try Again</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (!ticket) return null

  return (
    <div className="w-full space-y-6">
      {/* Top back navigation bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(isAgent ? "/agent" : "/customer")}
          className="h-8.5 rounded-xl flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 border border-transparent hover:border-indigo-100 -ml-1 transition-all"
        >
          <ArrowLeft className="size-4" />
          <span>Back to {isAgent ? "Queue" : "Dashboard"}</span>
        </Button>

        <div className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-200/80 px-2.5 py-1 rounded-lg shadow-2xs">
          ID: {ticket.id}
        </div>
      </div>

      {/* Ticket Header & Description Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100/70 border border-slate-200/60 px-2 py-0.5 rounded-md">
                <Tag className="size-3 text-indigo-500" />
                {formatCategory(ticket.category)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Calendar className="size-3 text-slate-400" />
                Submitted {formatDate(ticket.createdAt)}
              </span>
              {ticket.updatedAt && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">
                    Updated {formatDate(ticket.updatedAt)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <AssignmentBadge isAssigned={ticket.agentId !== null} />
          </div>
        </div>

        {/* Description body in subtle tinted card */}
        <div className="border border-slate-200/70 rounded-xl bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Description
          </h3>
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Agent Controls Workspace Toolbar */}
        {isAgent && (
          <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-violet-50/30 p-4 rounded-xl border border-violet-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-violet-900 mr-1">Status:</span>
              {(["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as TicketStatus[]).map(
                (st) => (
                  <Button
                    key={st}
                    size="xs"
                    variant={ticket.status === st ? "default" : "outline"}
                    disabled={updateStatusMutation.isPending || ticket.status === st}
                    onClick={() => updateStatusMutation.mutate(st)}
                    className={`rounded-lg transition-all ${
                      ticket.status === st
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </Button>
                )
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {ticket.agentId === currentUser?.id ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate(null)}
                  className="rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Unassign Myself
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate(currentUser?.id || null)}
                  className="rounded-lg bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  Assign to Me
                </Button>
              )}

              <Button
                size="xs"
                variant="secondary"
                disabled={aiMutation.isPending}
                onClick={() => aiMutation.mutate()}
                className="rounded-lg flex items-center gap-1.5 text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-semibold shadow-xs shadow-violet-500/20"
              >
                {aiMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3 text-violet-200" />
                )}
                <span>AI Analyze</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* AI Error message if any */}
      {aiError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="font-medium">{aiError}</span>
        </div>
      )}

      {/* AI Analysis Card (Distinctive Violet/Lavender AI Assistance) */}
      {isAgent && currentAiAnalysis && (
        <div className="bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/70 rounded-2xl border border-violet-200/90 p-5 sm:p-6 space-y-4 shadow-sm shadow-violet-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-violet-950 font-bold text-sm">
              <div className="size-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shadow-violet-500/25">
                <Sparkles className="size-3.5" />
              </div>
              <span>✦ Gemini AI Ticket Analysis</span>
            </div>
            <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-0.5 rounded-full border border-violet-200/80 shadow-2xs">
              Sentiment: {currentAiAnalysis.sentiment}
            </span>
          </div>

          <div className="text-xs text-slate-700 bg-white/90 p-3.5 rounded-xl border border-violet-100 space-y-1 shadow-2xs">
            <strong className="text-slate-900 block font-bold">Summary:</strong>
            <p className="leading-relaxed">{currentAiAnalysis.summary}</p>
          </div>

          {currentAiAnalysis.suggestedReply && (
            <div className="text-xs bg-white/90 p-3.5 rounded-xl border border-violet-100 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 font-bold">Suggested Response:</strong>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplySuggested(currentAiAnalysis.suggestedReply!)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-2.5 py-1 rounded-lg shadow-xs transition-all"
                  >
                    <CornerDownLeft className="size-3" />
                    <span>Use in Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySuggested(currentAiAnalysis.suggestedReply!)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded-lg border border-slate-200/80 hover:bg-slate-50 transition-colors"
                  >
                    {copiedReply ? (
                      <>
                        <Check className="size-3 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-slate-700 italic leading-relaxed border-l-2 border-violet-400 pl-3">
                &ldquo;{currentAiAnalysis.suggestedReply}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Conversation Thread */}
      <section aria-label="Ticket Conversation" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              Conversation Thread
            </h2>
          </div>
          {messages && messages.length > 0 && (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Message Loading */}
        {isMessagesLoading && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}

        {/* Message Error */}
        {isMessagesError && (
          <div
            role="alert"
            className="bg-white rounded-2xl border border-rose-200 p-4 text-xs text-rose-800 flex items-center justify-between"
          >
            <span>
              {messagesError instanceof Error
                ? messagesError.message
                : "Unable to load conversation history."}
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => refetchMessages()}
              className="rounded-lg border-rose-200 text-rose-800"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty conversation */}
        {!isMessagesLoading && !isMessagesError && (!messages || messages.length === 0) && (
          <div className="bg-white rounded-2xl border border-dashed border-indigo-200/80 p-8 text-center space-y-2 shadow-2xs">
            <p className="text-sm font-bold text-slate-800">No messages yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are no messages in this ticket yet. Send a message below to start the conversation with the support team.
            </p>
          </div>
        )}

        {/* Message List with soft indigo/violet distinction */}
        {!isMessagesLoading && messages && messages.length > 0 && (
          <div className="space-y-3.5">
            {messages.map((msg) => {
              const isCurrentUser = msg.senderId === currentUser?.id
              return (
                <div
                  key={msg.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isCurrentUser
                      ? "bg-indigo-50/40 border-indigo-200/70 ml-3 sm:ml-10 shadow-2xs"
                      : "bg-violet-50/30 border-violet-200/60 mr-3 sm:mr-10 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrentUser
                          ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xs"
                          : "bg-violet-100 text-violet-700"
                      }`}>
                        {isCurrentUser ? <User className="size-3" /> : <Headphones className="size-3" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {isCurrentUser ? "You" : isAgent ? "Customer" : "Support Agent"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed pl-8">
                    {msg.content}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Reply Submission Form with focused indigo composer */}
        <form
          onSubmit={handleSendReply}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5 shadow-2xs focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="reply-content"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Send a Reply
            </label>
            <span className="text-[11px] text-slate-400">
              {replyContent.length} / 5,000 characters
            </span>
          </div>

          {replyError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{replyError}</span>
            </div>
          )}

          <textarea
            id="reply-content"
            rows={3}
            value={replyContent}
            maxLength={5000}
            onChange={(e) => {
              setReplyContent(e.target.value)
              if (replyError) setReplyError(null)
            }}
            disabled={sendMessageMutation.isPending}
            placeholder="Type your response here..."
            className="w-full p-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-y"
          />

          <div className="flex items-center justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={sendMessageMutation.isPending || !replyContent.trim()}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 px-4 h-9"
            >
              {sendMessageMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Send Reply</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
