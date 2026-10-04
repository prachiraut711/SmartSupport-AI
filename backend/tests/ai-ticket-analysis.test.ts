import { test, describe, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { geminiService } from "../src/services/gemini.service"
import { AppError } from "../src/middleware/error.middleware"
import { AIAnalysisResponse, AIAnalysisResult } from "../src/types/ai.types"

describe("AI Ticket Analysis (POST /api/tickets/:ticketId/ai-analysis)", () => {
  let server: Server
  let baseUrl: string

  const emailCust = "ai.cust@example.com"
  const emailAgent = "ai.agent@example.com"

  let custId: string
  let agentId: string

  let custToken: string
  let agentToken: string

  let ticketId: string

  const defaultMockAnalysis: AIAnalysisResult = {
    category: "TECHNICAL",
    priority: "HIGH",
    sentiment: "NEGATIVE",
    summary: "Customer is unable to log into the application due to server error.",
    suggestedReply: "I apologize for the login difficulty. Please try clearing your cache or resetting your password.",
  }

  const originalAnalyzeTicket = geminiService.analyzeTicket

  before(async () => {
    // 1. Clean up stale test records
    const allEmails = [emailCust, emailAgent]
    await prisma.aIAnalysis.deleteMany({
      where: {
        ticket: { customer: { email: { in: allEmails } } },
      },
    })
    await prisma.message.deleteMany({
      where: {
        sender: { email: { in: allEmails } },
      },
    })
    await prisma.ticket.deleteMany({
      where: {
        customer: { email: { in: allEmails } },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: allEmails },
      },
    })

    // 2. Create test users
    const pwdHash = await hashPassword("TestPass123!")

    const cust = await prisma.user.create({
      data: {
        name: "AI Test Customer",
        email: emailCust,
        password: pwdHash,
        role: "CUSTOMER",
      },
    })
    custId = cust.id
    custToken = signToken({ userId: custId, role: "CUSTOMER" })

    const agent = await prisma.user.create({
      data: {
        name: "AI Test Agent",
        email: emailAgent,
        password: pwdHash,
        role: "AGENT",
      },
    })
    agentId = agent.id
    agentToken = signToken({ userId: agentId, role: "AGENT" })

    // 3. Create a test ticket with baseline values
    const ticket = await prisma.ticket.create({
      data: {
        title: "Login failure on web portal",
        description: "Whenever I click submit, the page displays error 500.",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: custId,
        agentId: null,
      },
    })
    ticketId = ticket.id

    // 4. Start HTTP test server
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://localhost:${port}`
  })

  after(async () => {
    // Restore original Gemini service method
    geminiService.analyzeTicket = originalAnalyzeTicket

    // Close HTTP test server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })

    // Clean up test database records
    const allEmails = [emailCust, emailAgent]
    await prisma.aIAnalysis.deleteMany({
      where: {
        ticket: { customer: { email: { in: allEmails } } },
      },
    })
    await prisma.message.deleteMany({
      where: {
        sender: { email: { in: allEmails } },
      },
    })
    await prisma.ticket.deleteMany({
      where: {
        customer: { email: { in: allEmails } },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: allEmails },
      },
    })
  })

  beforeEach(() => {
    // Reset mock to default successful analysis before each subtest
    geminiService.analyzeTicket = async () => defaultMockAnalysis
  })

  // 1. Agent can generate analysis for an existing ticket -> 200
  test("1. Authenticated AGENT can generate analysis for an existing ticket (HTTP 200)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AIAnalysisResponse
    assert.equal(body.ticketId, ticketId)
    assert.equal(body.category, "TECHNICAL")
    assert.equal(body.priority, "HIGH")
    assert.equal(body.sentiment, "NEGATIVE")
    assert.equal(body.summary, defaultMockAnalysis.summary)
    assert.equal(body.suggestedReply, defaultMockAnalysis.suggestedReply)
  })

  // 2. Customer cannot generate analysis -> 403
  test("2. CUSTOMER cannot generate analysis and receives HTTP 403", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${custToken}`,
      },
    })

    assert.equal(res.status, 403)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Forbidden: insufficient permissions")
  })

  // 3. Unauthenticated request -> 401
  test("3. Unauthenticated request returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 4. Invalid JWT -> 401
  test("4. Invalid JWT token returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid.jwt.token",
      },
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 5. Invalid ticket UUID -> 400
  test("5. Invalid ticket UUID returns HTTP 400 with 'Invalid ticket ID'", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/not-a-valid-uuid/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 400)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Invalid ticket ID")
  })

  // 6. Nonexistent ticket -> 404
  test("6. Nonexistent ticket ID returns HTTP 404 with 'Ticket not found'", async () => {
    const nonExistentUuid = "00000000-0000-4000-8000-000000000000"
    const res = await fetch(`${baseUrl}/api/tickets/${nonExistentUuid}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 404)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Ticket not found")
  })

  // 7 - 12. Valid Gemini response is saved to AIAnalysis with correct fields
  test("7-12. Valid Gemini response is persisted in AIAnalysis with exact category, priority, sentiment, summary, and suggestedReply", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 200)

    // Verify record in PostgreSQL database via Prisma
    const record = await prisma.aIAnalysis.findUnique({
      where: { ticketId },
    })

    assert(record !== null, "AIAnalysis record must exist in PostgreSQL")
    assert.equal(record.ticketId, ticketId)
    assert.equal(record.category, "TECHNICAL")
    assert.equal(record.priority, "HIGH")
    assert.equal(record.sentiment, "NEGATIVE")
    assert.equal(record.summary, defaultMockAnalysis.summary)
    assert.equal(record.suggestedReply, defaultMockAnalysis.suggestedReply)
    assert(record.createdAt instanceof Date)
    assert(record.updatedAt instanceof Date)
  })

  // 13. ticketId is taken from URL/database context, not request body
  test("13. ticketId is derived strictly from URL params, client request body ticketId is ignored", async () => {
    const fakeBodyTicketId = "11111111-1111-4111-8111-111111111111"
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        ticketId: fakeBodyTicketId,
      }),
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AIAnalysisResponse
    assert.equal(body.ticketId, ticketId)
    assert.notEqual(body.ticketId, fakeBodyTicketId)
  })

  // 14. Client-supplied fake AI values cannot override Gemini result
  test("14. Client-supplied fake AI values in request body are strictly ignored", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        category: "BILLING",
        priority: "LOW",
        sentiment: "POSITIVE",
        summary: "Fake summary injected by client",
        suggestedReply: "Fake reply injected by client",
      }),
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AIAnalysisResponse
    // Must contain Gemini's actual values, not client values
    assert.equal(body.category, "TECHNICAL")
    assert.equal(body.priority, "HIGH")
    assert.equal(body.sentiment, "NEGATIVE")
    assert.equal(body.summary, defaultMockAnalysis.summary)
    assert.equal(body.suggestedReply, defaultMockAnalysis.suggestedReply)
  })

  // 15 & 16. Calling endpoint twice does not duplicate records, updates existing analysis
  test("15 & 16. Re-analysis updates the existing record without creating duplicate AIAnalysis rows", async () => {
    // Second analysis with updated AI values
    const updatedMockAnalysis: AIAnalysisResult = {
      category: "TECHNICAL",
      priority: "URGENT",
      sentiment: "NEGATIVE",
      summary: "Updated summary: Severe database outage causing 500 errors on authentication.",
      suggestedReply: "Our engineering team has been notified and is investigating the service interruption.",
    }
    geminiService.analyzeTicket = async () => updatedMockAnalysis

    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AIAnalysisResponse
    assert.equal(body.priority, "URGENT")
    assert.equal(body.summary, updatedMockAnalysis.summary)

    // Ensure database contains exactly 1 record for this ticketId
    const count = await prisma.aIAnalysis.count({
      where: { ticketId },
    })
    assert.equal(count, 1, "Exactly one AIAnalysis record must exist per ticket")

    const updatedRecord = await prisma.aIAnalysis.findUnique({
      where: { ticketId },
    })
    assert.equal(updatedRecord?.priority, "URGENT")
    assert.equal(updatedRecord?.summary, updatedMockAnalysis.summary)
  })

  // 17 - 20. Ticket status, assignment, priority, and category are NOT automatically changed
  test("17-20. Assistive boundary: Ticket status, priority, category, and assignment are NEVER modified automatically", async () => {
    // Ticket was created with: status = OPEN, priority = LOW, category = OTHER, agentId = null
    const ticketBefore = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })
    assert.equal(ticketBefore?.status, "OPEN")
    assert.equal(ticketBefore?.priority, "LOW")
    assert.equal(ticketBefore?.category, "OTHER")
    assert.equal(ticketBefore?.agentId, null)

    // AI analysis returns category = TECHNICAL, priority = HIGH
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })
    assert.equal(res.status, 200)

    // Check Ticket after AI analysis
    const ticketAfter = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })
    assert.equal(ticketAfter?.status, "OPEN", "Ticket status must remain unchanged")
    assert.equal(ticketAfter?.priority, "LOW", "Ticket priority must remain unchanged")
    assert.equal(ticketAfter?.category, "OTHER", "Ticket category must remain unchanged")
    assert.equal(ticketAfter?.agentId, null, "Ticket assignment must remain unchanged")
  })

  // 21. Gemini service failure returns controlled 503
  test("21. Gemini service failure is converted to controlled HTTP 503", async () => {
    geminiService.analyzeTicket = async () => {
      throw new AppError("AI service temporarily unavailable", 503)
    }

    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 503)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "AI service temporarily unavailable")
  })

  // 22. Invalid Gemini result returns controlled 502
  test("22. Invalid Gemini response is converted to controlled HTTP 502", async () => {
    geminiService.analyzeTicket = async () => {
      throw new AppError("AI returned an invalid analysis", 502)
    }

    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 502)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "AI returned an invalid analysis")
  })

  // 23. API key is never returned in response
  test("23. API key or server secrets are never returned in response", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 200)
    const rawText = await res.text()
    assert(!rawText.includes("GEMINI_API_KEY"))
    assert(!rawText.includes("AIzaSy"))
    assert(!rawText.includes("TestPass123!"))
    assert(!rawText.includes("$2b$"))
  })

  // 24. Response contains only safe AI analysis fields
  test("24. Response contains only safe AI analysis fields without internal relations or passwords", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as Record<string, unknown>

    const expectedKeys = [
      "id",
      "ticketId",
      "category",
      "priority",
      "sentiment",
      "summary",
      "suggestedReply",
      "createdAt",
      "updatedAt",
    ]

    for (const key of expectedKeys) {
      assert(key in body, `Expected ${key} to be present in response`)
    }

    // Verify forbidden fields are absent
    assert(!("ticket" in body), "Prisma relation ticket must not be returned")
    assert(!("customer" in body), "Customer relation must not be returned")
    assert(!("password" in body), "Password must not be returned")
  })

  // 25. Authenticated AGENT retrieves saved AI analysis (HTTP 200)
  test("25. Authenticated AGENT retrieves saved AI analysis (HTTP 200)", async () => {
    // Ensure an analysis exists
    await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agentToken}` },
    })

    let geminiCalled = false
    geminiService.analyzeTicket = async () => {
      geminiCalled = true
      return defaultMockAnalysis
    }

    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: `Bearer ${agentToken}` },
    })

    assert.equal(res.status, 200)
    assert.equal(geminiCalled, false, "GET endpoint must NOT call Gemini API")

    const body = (await res.json()) as AIAnalysisResponse
    assert.equal(body.ticketId, ticketId)
    assert.equal(body.category, "TECHNICAL")
    assert.equal(body.priority, "HIGH")
    assert.equal(body.sentiment, "NEGATIVE")
    assert.equal(body.summary, defaultMockAnalysis.summary)
    assert.equal(body.suggestedReply, defaultMockAnalysis.suggestedReply)
    assert.ok(body.createdAt)
    assert.ok(body.updatedAt)
  })

  // 26. Ticket exists but has no AI analysis returns HTTP 404
  test("26. Ticket exists but has no AI analysis returns HTTP 404", async () => {
    const freshTicket = await prisma.ticket.create({
      data: {
        title: "Ticket without AI analysis",
        description: "Fresh ticket description",
        status: "OPEN",
        customerId: custId,
      },
    })

    const res = await fetch(`${baseUrl}/api/tickets/${freshTicket.id}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: `Bearer ${agentToken}` },
    })

    assert.equal(res.status, 404)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "AI analysis not found")

    // Clean up
    await prisma.ticket.delete({ where: { id: freshTicket.id } })
  })

  // 27. Nonexistent ticket ID returns HTTP 404
  test("27. Nonexistent ticket ID returns HTTP 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000"
    const res = await fetch(`${baseUrl}/api/tickets/${fakeId}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: `Bearer ${agentToken}` },
    })

    assert.equal(res.status, 404)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Ticket not found")
  })

  // 28. Malformed ticket ID format returns HTTP 400
  test("28. Malformed ticket ID format returns HTTP 400", async () => {
    const invalidIds = ["not-a-uuid", "12345", "abc-def", "   "]
    for (const badId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${encodeURIComponent(badId)}/ai-analysis`, {
        method: "GET",
        headers: { Authorization: `Bearer ${agentToken}` },
      })

      assert.equal(res.status, 400)
      const body = (await res.json()) as { error: string }
      assert.equal(body.error, "Invalid ticket ID")
    }
  })

  // 29. Unauthenticated request to GET returns HTTP 401
  test("29. Unauthenticated request to GET /api/tickets/:ticketId/ai-analysis returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "GET",
    })

    assert.equal(res.status, 401)
  })

  // 30. Invalid JWT returns HTTP 401
  test("30. Invalid JWT returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: "Bearer invalid.token.value" },
    })

    assert.equal(res.status, 401)
  })

  // 31. CUSTOMER role attempting to GET AI analysis returns HTTP 403
  test("31. CUSTOMER role attempting to GET AI analysis returns HTTP 403", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: `Bearer ${custToken}` },
    })

    assert.equal(res.status, 403)
  })

  // 32. Subsequent POST updates analysis and subsequent GET returns updated analysis
  test("32. Subsequent POST updates analysis and subsequent GET returns updated analysis", async () => {
    const updatedMock: AIAnalysisResult = {
      category: "BILLING",
      priority: "URGENT",
      sentiment: "POSITIVE",
      summary: "Customer requested a billing adjustment.",
      suggestedReply: "We have updated your billing plan accordingly.",
    }

    geminiService.analyzeTicket = async () => updatedMock

    // Trigger update via POST
    const postRes = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agentToken}` },
    })
    assert.equal(postRes.status, 200)

    // Retrieve via GET
    const getRes = await fetch(`${baseUrl}/api/tickets/${ticketId}/ai-analysis`, {
      method: "GET",
      headers: { Authorization: `Bearer ${agentToken}` },
    })
    assert.equal(getRes.status, 200)
    const body = (await getRes.json()) as AIAnalysisResponse
    assert.equal(body.category, "BILLING")
    assert.equal(body.priority, "URGENT")
    assert.equal(body.sentiment, "POSITIVE")
    assert.equal(body.summary, updatedMock.summary)
    assert.equal(body.suggestedReply, updatedMock.suggestedReply)
  })
})
