import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom"
import LandingPage from "@/pages/LandingPage"
import AuthLayout from "@/layouts/AuthLayout"
import CustomerLayout from "@/layouts/CustomerLayout"
import AgentLayout from "@/layouts/AgentLayout"
import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"
import CustomerDashboardPage from "@/pages/customer/CustomerDashboardPage"
import CustomerTicketDetailPage from "@/pages/customer/CustomerTicketDetailPage"
import AgentDashboardPage from "@/pages/agent/AgentDashboardPage"
import { getCurrentUser } from "@/services/authService"

/**
 * Route wrapper for Customer ticket details (/tickets/:ticketId).
 * If the authenticated user is an AGENT, redirect to /agent/tickets/:ticketId
 * so they see the Agent Workspace layout and controls.
 */
function CustomerTicketDetailRoute() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const user = getCurrentUser()

  if (user?.role === "AGENT" && ticketId) {
    return <Navigate to={`/agent/tickets/${ticketId}`} replace />
  }

  return <CustomerTicketDetailPage key={ticketId} />
}

/**
 * Route wrapper for Agent ticket details (/agent/tickets/:ticketId).
 * Enforces role access:
 * - If not authenticated, redirects to /login.
 * - If user is a CUSTOMER, redirects to /tickets/:ticketId (Customer Portal view).
 * - If user is an AGENT, renders CustomerTicketDetailPage inside AgentLayout.
 */
function AgentTicketDetailRoute() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "CUSTOMER" && ticketId) {
    return <Navigate to={`/tickets/${ticketId}`} replace />
  }

  return <CustomerTicketDetailPage key={ticketId} />
}

/**
 * Route wrapper for Customer Dashboard (/customer).
 * If user is an AGENT, redirect to /agent.
 */
function CustomerDashboardRoute() {
  const user = getCurrentUser()

  if (user?.role === "AGENT") {
    return <Navigate to="/agent" replace />
  }

  return <CustomerDashboardPage />
}

/**
 * Route wrapper for Agent Dashboard (/agent).
 * If user is not authenticated, redirect to /login.
 * If user is a CUSTOMER, redirect to /customer.
 */
function AgentDashboardRoute() {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "CUSTOMER") {
    return <Navigate to="/customer" replace />
  }

  return <AgentDashboardPage />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Authentication Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Customer Portal Routes */}
        <Route element={<CustomerLayout />}>
          <Route path="/customer" element={<CustomerDashboardRoute />} />
          <Route path="/tickets/:ticketId" element={<CustomerTicketDetailRoute />} />
        </Route>

        {/* Agent Workspace Routes */}
        <Route element={<AgentLayout />}>
          <Route path="/agent" element={<AgentDashboardRoute />} />
          <Route path="/agent/tickets/:ticketId" element={<AgentTicketDetailRoute />} />
        </Route>

        {/* Fallback Catch-All */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
