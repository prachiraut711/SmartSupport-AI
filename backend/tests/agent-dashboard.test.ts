import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { AgentDashboardResponse } from "../src/types/agent-dashboard.types"
import { CustomerDashboardResponse } from "../src/types/dashboard.types"
import { geminiService } from "../src/services/gemini.service"

describe("Agent Dashboard (GET /api/agent/dashboard)", () => {
  let server: Server
  let baseUrl: string

  const emailAgentA = "agent.dashA@example.com"
  const emailAgentB = "agent.dashB@example.com"
  const emailCustA = "cust.dashA@example.com"
  const emailCustB = "cust.dashB@example.com"

  let agentAId: string
  let agentBId: string
  let custAId: string
  let custBId: string

  let tokenAgentA: string
  let tokenAgentB: string
  let tokenCustA: string

  const createdTicketIds: string[] = []

  const originalAnalyzeTicket = geminiService.analyzeTicket

  before(async () => {
    // Clean up all existing records to ensure deterministic database counts
    await prisma.aIAnalysis.deleteMany()
    await prisma.message.deleteMany()
    await prisma.ticket.deleteMany()
    await prisma.user.deleteMany()

    // Create users
    const pwdHash = await hashPassword("TestPass123!")

    const agentA = await prisma.user.create({
      data: { name: "Agent Alpha", email: emailAgentA, password: pwdHash, role: "AGENT" },
    })
    agentAId = agentA.id
    tokenAgentA = signToken({ userId: agentAId, role: "AGENT" })

    const agentB = await prisma.user.create({
      data: { name: "Agent Beta", email: emailAgentB, password: pwdHash, role: "AGENT" },
    })
    agentBId = agentB.id
    tokenAgentB = signToken({ userId: agentBId, role: "AGENT" })

    const custA = await prisma.user.create({
      data: { name: "Customer Alpha", email: emailCustA, password: pwdHash, role: "CUSTOMER" },
    })
    custAId = custA.id
    tokenCustA = signToken({ userId: custAId, role: "CUSTOMER" })

    const custB = await prisma.user.create({
      data: { name: "Customer Beta", email: emailCustB, password: pwdHash, role: "CUSTOMER" },
    })
    custBId = custB.id

    // Start HTTP test server
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://localhost:${port}`

    // Mock Gemini for integration check
    geminiService.analyzeTicket = async () => ({
      category: "TECHNICAL",
      priority: "HIGH",
      sentiment: "NEGATIVE",
      summary: "Mock analysis summary for test.",
      suggestedReply: "Mock suggested reply for test.",
    })
  })

  after(async () => {
    geminiService.analyzeTicket = originalAnalyzeTicket

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })

    await prisma.aIAnalysis.deleteMany()
    await prisma.message.deleteMany()
    await prisma.ticket.deleteMany()
    await prisma.user.deleteMany()
  })

  // 17. Empty database behavior
  test("17. Empty database returns zero stats and empty recentTickets array with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    assert.deepEqual(body.stats, {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      waitingForCustomerTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
      assignedTickets: 0,
      unassignedTickets: 0,
    })
    assert.deepEqual(body.recentTickets, [])
  })

  // Populate test tickets after verifying empty database state
  test("Populate 12 tickets across multiple customers and assignments", async () => {
    const baseTime = new Date("2026-10-01T12:00:00Z").getTime()

    // Ticket specifications:
    // 1: custA, agentA, OPEN
    // 2: custA, agentB, OPEN
    // 3: custB, unassigned (null), OPEN
    // 4: custB, agentA, IN_PROGRESS
    // 5: custA, unassigned (null), IN_PROGRESS
    // 6: custB, agentB, WAITING_FOR_CUSTOMER
    // 7: custA, unassigned (null), WAITING_FOR_CUSTOMER
    // 8: custB, agentA, RESOLVED
    // 9: custA, unassigned (null), RESOLVED
    // 10: custB, agentB, CLOSED
    // 11: custA, unassigned (null), CLOSED
    // 12: custB, agentA, OPEN
    const ticketConfigs = [
      { custId: custAId, agentId: agentAId, status: "OPEN" },
      { custId: custAId, agentId: agentBId, status: "OPEN" },
      { custId: custBId, agentId: null, status: "OPEN" },
      { custId: custBId, agentId: agentAId, status: "IN_PROGRESS" },
      { custId: custAId, agentId: null, status: "IN_PROGRESS" },
      { custId: custBId, agentId: agentBId, status: "WAITING_FOR_CUSTOMER" },
      { custId: custAId, agentId: null, status: "WAITING_FOR_CUSTOMER" },
      { custId: custBId, agentId: agentAId, status: "RESOLVED" },
      { custId: custAId, agentId: null, status: "RESOLVED" },
      { custId: custBId, agentId: agentBId, status: "CLOSED" },
      { custId: custAId, agentId: null, status: "CLOSED" },
      { custId: custBId, agentId: agentAId, status: "OPEN" },
    ] as const

    for (let i = 0; i < ticketConfigs.length; i++) {
      const cfg = ticketConfigs[i]
      const t = await prisma.ticket.create({
        data: {
          title: `Ticket ${i + 1} ${cfg.status}`,
          description: `Description for ticket ${i + 1}`,
          status: cfg.status,
          priority: i % 2 === 0 ? "HIGH" : "MEDIUM",
          category: i % 3 === 0 ? "TECHNICAL" : "BILLING",
          customerId: cfg.custId,
          agentId: cfg.agentId,
          createdAt: new Date(baseTime + i * 60000), // sequentially spaced
        },
      })
      createdTicketIds.push(t.id)
    }

    assert.equal(createdTicketIds.length, 12)
  })

  // 1. Authenticated AGENT can access dashboard
  test("1. Authenticated AGENT can access dashboard (HTTP 200)", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    assert(typeof body.stats === "object", "stats must be an object")
    assert(Array.isArray(body.recentTickets), "recentTickets must be an array")
  })

  // 2. CUSTOMER receives 403
  test("2. CUSTOMER receives HTTP 403 on agent dashboard", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 403)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Forbidden: insufficient permissions")
  })

  // 3. Missing token returns 401
  test("3. Missing token returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 4. Invalid JWT returns 401
  test("4. Invalid JWT returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid.jwt.token",
      },
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 5 - 12. Statistics verification
  test("5-12. Statistics correctly reflect total, status, and assignment counts", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    const { stats } = body

    // 5. totalTickets
    assert.equal(stats.totalTickets, 12, "totalTickets must be 12")
    // 6. openTickets
    assert.equal(stats.openTickets, 4, "openTickets must be 4")
    // 7. inProgressTickets
    assert.equal(stats.inProgressTickets, 2, "inProgressTickets must be 2")
    // 8. waitingForCustomerTickets
    assert.equal(stats.waitingForCustomerTickets, 2, "waitingForCustomerTickets must be 2")
    // 9. resolvedTickets
    assert.equal(stats.resolvedTickets, 2, "resolvedTickets must be 2")
    // 10. closedTickets
    assert.equal(stats.closedTickets, 2, "closedTickets must be 2")
    // 11. assignedTickets
    assert.equal(stats.assignedTickets, 7, "assignedTickets must be 7")
    // 12. unassignedTickets
    assert.equal(stats.unassignedTickets, 5, "unassignedTickets must be 5")
  })

  // 13. Recent tickets are returned newest first
  test("13. Recent tickets are returned newest first (createdAt DESC)", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    const tickets = body.recentTickets

    assert(tickets.length >= 2, "Must have at least 2 tickets to check ordering")
    for (let i = 0; i < tickets.length - 1; i++) {
      const currentCreatedAt = new Date(tickets[i].createdAt).getTime()
      const nextCreatedAt = new Date(tickets[i + 1].createdAt).getTime()
      assert(
        currentCreatedAt >= nextCreatedAt,
        `Expected ticket ${i} (createdAt: ${tickets[i].createdAt}) to be newer or equal to ticket ${i + 1} (createdAt: ${tickets[i + 1].createdAt})`
      )
    }
  })

  // 14. Maximum 10 recent tickets are returned
  test("14. Maximum 10 recent tickets are returned even though database has 12 tickets", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    assert.equal(body.recentTickets.length, 10, "recentTickets must be capped at 10")
  })

  // 15. Recent tickets include tickets from different customers
  test("15. Recent tickets include tickets from different customers (cross-customer visibility for agents)", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    const customerIds = body.recentTickets.map((t) => t.customerId)

    assert(customerIds.includes(custAId), "recentTickets must include tickets from Customer A")
    assert(customerIds.includes(custBId), "recentTickets must include tickets from Customer B")
  })

  // 16. Response contains only the allowed ticket fields
  test("16. Response contains only allowed ticket fields without user relations, passwords, or messages", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse

    const allowedKeys = [
      "id",
      "title",
      "status",
      "priority",
      "category",
      "customerId",
      "agentId",
      "createdAt",
      "updatedAt",
    ]

    for (const ticket of body.recentTickets) {
      const keys = Object.keys(ticket)
      for (const k of keys) {
        assert(allowedKeys.includes(k), `Unexpected field ${k} in agent dashboard ticket`)
      }
      assert(!("customer" in ticket), "customer relation must not be in ticket response")
      assert(!("agent" in ticket), "agent relation must not be in ticket response")
      assert(!("messages" in ticket), "messages relation must not be in ticket response")
      assert(!("aiAnalysis" in ticket), "aiAnalysis relation must not be in ticket response")
      assert(!("password" in ticket), "password must not be in ticket response")
    }
  })

  // 18. Query parameters cannot alter dashboard results
  test("18. Query parameters (?agentId=...&customerId=...) cannot alter dashboard results", async () => {
    const res = await fetch(`${baseUrl}/api/agent/dashboard?customerId=${custAId}&agentId=${agentBId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as AgentDashboardResponse
    // Must return global metrics (12 tickets), not filtered by query params
    assert.equal(body.stats.totalTickets, 12)
    assert.equal(body.recentTickets.length, 10)
  })

  // 19. Existing customer dashboard still works
  test("19. Existing customer dashboard (GET /api/customer/dashboard) still works independently", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    // Customer A has 6 tickets
    assert.equal(body.stats.totalTickets, 6)
    assert.equal(body.recentTickets.length, 5) // Customer dashboard caps at 5
  })

  // 20. Existing agent ticket listing still works
  test("20. Existing agent ticket listing (GET /api/tickets) still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as { tickets: any[] }
    assert.equal(body.tickets.length, 12)
  })

  // 21. Existing ticket details still work
  test("21. Existing ticket details (GET /api/tickets/:ticketId) still work", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(res.status, 200)
    const ticket = (await res.json()) as { id: string; title: string }
    assert.equal(ticket.id, createdTicketIds[0])
  })

  // 22. Existing ticket updates still work
  test("22. Existing agent ticket update (PATCH /api/tickets/:ticketId) still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
        priority: "URGENT",
      }),
    })

    assert.equal(res.status, 200)
    const ticket = (await res.json()) as { id: string; status: string; priority: string }
    assert.equal(ticket.status, "RESOLVED")
    assert.equal(ticket.priority, "URGENT")
  })

  // 23. Existing assignment functionality still works
  test("23. Existing ticket assignment (PATCH /api/tickets/:ticketId/assignment) still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[2]}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: agentBId,
      }),
    })

    assert.equal(res.status, 200)
    const ticket = (await res.json()) as { id: string; agentId: string }
    assert.equal(ticket.agentId, agentBId)
  })

  // 24. Existing messages functionality still works
  test("24. Existing message creation and history (POST/GET /api/tickets/:id/messages) still work", async () => {
    const postRes = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        content: "Testing agent reply from dashboard regression test",
      }),
    })

    assert.equal(postRes.status, 201)

    const getRes = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(getRes.status, 200)
    const getBody = (await getRes.json()) as { messages: any[] }
    assert.equal(getBody.messages.length, 1)
  })

  // 25. Existing AI analysis functionality still works
  test("25. Existing AI analysis (POST /api/tickets/:id/ai-analysis) still works", async () => {
    const aiRes = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.equal(aiRes.status, 200)
    const aiBody = (await aiRes.json()) as { category: string; summary: string }
    assert.equal(aiBody.category, "TECHNICAL")
    assert.equal(aiBody.summary, "Mock analysis summary for test.")
  })
})
