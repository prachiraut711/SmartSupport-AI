import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { CustomerDashboardResponse } from "../src/types/dashboard.types"
import { geminiService } from "../src/services/gemini.service"

describe("Customer Dashboard (GET /api/customer/dashboard)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "dash.custA@example.com"
  const emailCustB = "dash.custB@example.com"
  const emailCustEmpty = "dash.custEmpty@example.com"
  const emailAgent = "dash.agent@example.com"

  let custAId: string
  let custBId: string
  let custEmptyId: string
  let agentId: string

  let tokenCustA: string
  let tokenCustB: string
  let tokenCustEmpty: string
  let tokenAgent: string

  let custATicketIds: string[] = []
  let custBTicketIds: string[] = []

  const originalAnalyzeTicket = geminiService.analyzeTicket

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustA, emailCustB, emailCustEmpty, emailAgent]
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

    // 2. Create users
    const pwdHash = await hashPassword("TestPass123!")

    const custA = await prisma.user.create({
      data: { name: "Customer Alpha", email: emailCustA, password: pwdHash, role: "CUSTOMER" },
    })
    custAId = custA.id
    tokenCustA = signToken({ userId: custAId, role: "CUSTOMER" })

    const custB = await prisma.user.create({
      data: { name: "Customer Beta", email: emailCustB, password: pwdHash, role: "CUSTOMER" },
    })
    custBId = custB.id
    tokenCustB = signToken({ userId: custBId, role: "CUSTOMER" })

    const custEmpty = await prisma.user.create({
      data: { name: "Customer Empty", email: emailCustEmpty, password: pwdHash, role: "CUSTOMER" },
    })
    custEmptyId = custEmpty.id
    tokenCustEmpty = signToken({ userId: custEmptyId, role: "CUSTOMER" })

    const agent = await prisma.user.create({
      data: { name: "Agent Support", email: emailAgent, password: pwdHash, role: "AGENT" },
    })
    agentId = agent.id
    tokenAgent = signToken({ userId: agentId, role: "AGENT" })

    // 3. Create 7 tickets for Customer A with sequential creation times
    const baseDate = new Date("2026-10-01T10:00:00Z").getTime()
    const statusesA = [
      "OPEN",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_CUSTOMER",
      "RESOLVED",
      "RESOLVED",
      "CLOSED",
    ] as const

    for (let i = 0; i < statusesA.length; i++) {
      const t = await prisma.ticket.create({
        data: {
          title: `Ticket A-${i + 1} ${statusesA[i]}`,
          description: `Description for ticket ${i + 1}`,
          status: statusesA[i],
          priority: i % 2 === 0 ? "HIGH" : "MEDIUM",
          category: "TECHNICAL",
          customerId: custAId,
          createdAt: new Date(baseDate + i * 60000), // strictly spaced in time
        },
      })
      custATicketIds.push(t.id)
    }

    // 4. Create 3 tickets for Customer B
    const statusesB = ["OPEN", "IN_PROGRESS", "CLOSED"] as const
    for (let i = 0; i < statusesB.length; i++) {
      const t = await prisma.ticket.create({
        data: {
          title: `Ticket B-${i + 1} ${statusesB[i]}`,
          description: `Description for B ticket ${i + 1}`,
          status: statusesB[i],
          priority: "LOW",
          category: "BILLING",
          customerId: custBId,
        },
      })
      custBTicketIds.push(t.id)
    }

    // 5. Start HTTP test server
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://localhost:${port}`

    // Mock Gemini for integration test checks
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

    const allEmails = [emailCustA, emailCustB, emailCustEmpty, emailAgent]
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

  // 1. Customer can access dashboard -> 200
  test("1. Authenticated CUSTOMER can access their dashboard (HTTP 200)", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    assert(typeof body.stats === "object", "stats must be an object")
    assert(Array.isArray(body.recentTickets), "recentTickets must be an array")
  })

  // 2. Agent cannot access customer dashboard -> 403
  test("2. AGENT receives HTTP 403 on customer dashboard", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.equal(res.status, 403)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Forbidden: insufficient permissions")
  })

  // 3. Missing token -> 401
  test("3. Missing authentication token returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 4. Invalid JWT -> 401
  test("4. Invalid JWT returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid.token.value",
      },
    })

    assert.equal(res.status, 401)
    const body = (await res.json()) as { error: string }
    assert.equal(body.error, "Authentication required")
  })

  // 5 - 10. Dashboard counts are strictly correct for Customer A
  test("5-10. Dashboard statistics match exact ticket status counts for Customer A", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    const { stats } = body

    // Customer A has: 2 OPEN, 1 IN_PROGRESS, 1 WAITING_FOR_CUSTOMER, 2 RESOLVED, 1 CLOSED = 7 total
    assert.equal(stats.totalTickets, 7, "totalTickets must be 7")
    assert.equal(stats.openTickets, 2, "openTickets must be 2")
    assert.equal(stats.inProgressTickets, 1, "inProgressTickets must be 1")
    assert.equal(stats.waitingForCustomerTickets, 1, "waitingForCustomerTickets must be 1")
    assert.equal(stats.resolvedTickets, 2, "resolvedTickets must be 2")
    assert.equal(stats.closedTickets, 1, "closedTickets must be 1")
  })

  // Also check Customer B counts to verify separation
  test("Dashboard statistics for Customer B are completely isolated from Customer A", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustB}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    const { stats } = body

    // Customer B has: 1 OPEN, 1 IN_PROGRESS, 0 WAITING_FOR_CUSTOMER, 0 RESOLVED, 1 CLOSED = 3 total
    assert.equal(stats.totalTickets, 3, "Customer B totalTickets must be 3")
    assert.equal(stats.openTickets, 1, "Customer B openTickets must be 1")
    assert.equal(stats.inProgressTickets, 1, "Customer B inProgressTickets must be 1")
    assert.equal(stats.waitingForCustomerTickets, 0, "Customer B waitingForCustomerTickets must be 0")
    assert.equal(stats.resolvedTickets, 0, "Customer B resolvedTickets must be 0")
    assert.equal(stats.closedTickets, 1, "Customer B closedTickets must be 1")
  })

  // 11. Recent tickets contain only the authenticated customer's tickets
  test("11. Recent tickets contain ONLY the authenticated customer's tickets (no tickets from Customer B)", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    const returnedIds = body.recentTickets.map((t) => t.id)

    // All returned IDs must be in Customer A's ticket list
    for (const id of returnedIds) {
      assert(custATicketIds.includes(id), `Ticket ${id} must belong to Customer A`)
      assert(!custBTicketIds.includes(id), `Ticket ${id} must NOT belong to Customer B`)
    }
  })

  // 12. Recent tickets are ordered newest first (createdAt DESC)
  test("12. Recent tickets are ordered newest first (createdAt DESC)", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    const tickets = body.recentTickets

    assert(tickets.length >= 2, "Need at least 2 tickets to check ordering")
    for (let i = 0; i < tickets.length - 1; i++) {
      const currentCreatedAt = new Date(tickets[i].createdAt).getTime()
      const nextCreatedAt = new Date(tickets[i + 1].createdAt).getTime()
      assert(
        currentCreatedAt >= nextCreatedAt,
        `Expected ticket ${i} (createdAt: ${tickets[i].createdAt}) to be newer or equal to ticket ${i + 1} (createdAt: ${tickets[i + 1].createdAt})`
      )
    }
  })

  // 13. Maximum 5 recent tickets are returned
  test("13. Maximum 5 recent tickets are returned even though customer has 7 tickets", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    assert.equal(body.recentTickets.length, 5, "recentTickets must be capped at 5")
  })

  // 14. Customer with zero tickets gets zero stats and empty recentTickets
  test("14. Customer with zero tickets gets zero stats and empty recentTickets array with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustEmpty}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    assert.deepEqual(body.stats, {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      waitingForCustomerTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
    })
    assert.deepEqual(body.recentTickets, [])
  })

  // 15. customerId query parameter cannot change ownership
  test("15. customerId query parameter (?customerId=...) cannot hijack or alter ownership", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard?customerId=${custBId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse
    // Must return Customer A's stats (7 tickets), NOT Customer B's (3 tickets)
    assert.equal(body.stats.totalTickets, 7)
    for (const t of body.recentTickets) {
      assert(custATicketIds.includes(t.id))
    }
  })

  // 16. Response contains only safe ticket fields
  test("16. Response contains only safe ticket fields and no password or unrelated user data", async () => {
    const res = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as CustomerDashboardResponse

    const allowedKeys = ["id", "title", "status", "priority", "category", "createdAt", "updatedAt"]

    for (const ticket of body.recentTickets) {
      const keys = Object.keys(ticket)
      for (const k of keys) {
        assert(allowedKeys.includes(k), `Unexpected field ${k} in recent ticket response`)
      }
      assert(!("customerId" in ticket), "customerId should not be in recent ticket response")
      assert(!("agentId" in ticket), "agentId should not be in recent ticket response")
      assert(!("customer" in ticket), "customer relation should not be in response")
      assert(!("messages" in ticket), "messages relation should not be in response")
      assert(!("password" in ticket), "password should not be in response")
    }
  })

  // 17. Existing ticket creation still works
  test("17. Existing ticket creation still works and increments dashboard stats", async () => {
    const createRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustEmpty}`,
      },
      body: JSON.stringify({
        title: "New Ticket For Empty Customer",
        description: "Testing ticket creation impact on dashboard",
      }),
    })

    assert.equal(createRes.status, 201)
    const createdTicket = (await createRes.json()) as { id: string }

    // Dashboard should now show 1 total and 1 open
    const dashRes = await fetch(`${baseUrl}/api/customer/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustEmpty}`,
      },
    })

    assert.equal(dashRes.status, 200)
    const dashBody = (await dashRes.json()) as CustomerDashboardResponse
    assert.equal(dashBody.stats.totalTickets, 1)
    assert.equal(dashBody.stats.openTickets, 1)
    assert.equal(dashBody.recentTickets.length, 1)
    assert.equal(dashBody.recentTickets[0].id, createdTicket.id)
  })

  // 18. Existing ticket listing still works
  test("18. Existing customer ticket listing (GET /api/tickets) still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as { tickets: any[] }
    assert.equal(body.tickets.length, 7)
  })

  // 19. Existing ticket details still work
  test("19. Existing customer ticket details (GET /api/tickets/:ticketId) still work", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${custATicketIds[0]}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(res.status, 200)
    const ticket = (await res.json()) as { id: string; title: string }
    assert.equal(ticket.id, custATicketIds[0])
  })

  // 20. Existing message creation/history still works
  test("20. Existing message creation and history (GET/POST /api/tickets/:id/messages) still work", async () => {
    const postRes = await fetch(`${baseUrl}/api/tickets/${custATicketIds[0]}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "Testing reply for dashboard test ticket",
      }),
    })

    assert.equal(postRes.status, 201)

    const getRes = await fetch(`${baseUrl}/api/tickets/${custATicketIds[0]}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.equal(getRes.status, 200)
    const getBody = (await getRes.json()) as { messages: any[] }
    assert.equal(getBody.messages.length, 1)
    assert.equal(getBody.messages[0].content, "Testing reply for dashboard test ticket")
  })

  // 21. Existing AI analysis functionality still works
  test("21. Existing AI analysis functionality (POST /api/tickets/:id/ai-analysis) still works", async () => {
    const aiRes = await fetch(`${baseUrl}/api/tickets/${custATicketIds[0]}/ai-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.equal(aiRes.status, 200)
    const aiBody = (await aiRes.json()) as { category: string; summary: string }
    assert.equal(aiBody.category, "TECHNICAL")
    assert.equal(aiBody.summary, "Mock analysis summary for test.")
  })
})
