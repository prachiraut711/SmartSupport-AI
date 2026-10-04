import express, { Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.routes"
import ticketRoutes from "./routes/ticket.routes"
import messageRoutes from "./routes/message.routes"
import aiAnalysisRoutes from "./routes/ai-analysis.routes"
import customerDashboardRoutes from "./routes/customer-dashboard.routes"
import agentDashboardRoutes from "./routes/agent-dashboard.routes"
import { errorHandler } from "./middleware/error.middleware"

// Load environment variables from .env
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "SmartSupport AI API",
  })
})

// Application routes
app.use("/api/auth", authRoutes)
app.use("/api/tickets", ticketRoutes)
app.use("/api/tickets", messageRoutes)
app.use("/api/tickets", aiAnalysisRoutes)
app.use("/api/customer/dashboard", customerDashboardRoutes)
app.use("/api/agent/dashboard", agentDashboardRoutes)


// Centralized error handling middleware (must be registered after routes)
app.use(errorHandler)

// Start server (when executed as main entry point and not in test)
if (
  process.env.NODE_ENV !== "test" &&
  typeof require !== "undefined" &&
  require.main === module
) {
  app.listen(PORT, () => {
    console.log(`SmartSupport AI API running on port ${PORT}`)
  })
}

export default app
