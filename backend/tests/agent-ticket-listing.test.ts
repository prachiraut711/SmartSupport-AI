import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Agent Ticket Queue Listing (GET /api/tickets)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "agent.queue.custA@example.com"
  const emailCustB = "agent.queue.custB@example.com"
  const emailAgent = "agent.queue.agent@example.com"

  let idCustA: string
  let idCustB: string
  let idAgent: string

  let tokenCustA: string
  let tokenCustB: string
  let tokenAgent: string

  let ticketA1Id: string
  let ticketA2Id: string
  let ticketB1Id: string

  before(async () => {
    // 1. Clean up any existing test records
    const allEmails = [emailCustA, emailCustB, emailAgent]
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
    const passwordHash = await hashPassword("TestPass123!")

    const custA = await prisma.user.create({
      data: { name: "Customer Alpha", email: emailCustA, password: passwordHash, role: "CUSTOMER" },
    })
    idCustA = custA.id
    tokenCustA = signToken({ userId: idCustA, role: "CUSTOMER" })

    const custB = await prisma.user.create({
      data: { name: "Customer Beta", email: emailCustB, password: passwordHash, role: "CUSTOMER" },
    })
    idCustB = custB.id
    tokenCustB = signToken({ userId: idCustB, role: "CUSTOMER" })

    const agent = await prisma.user.create({
      data: { name: "Support Agent", email: emailAgent, password: passwordHash, role: "AGENT" },
    })
    idAgent = agent.id
    tokenAgent = signToken({ userId: idAgent, role: "AGENT" })

    // 3. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    // Clean up test tickets
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [idCustA, idCustB, idAgent] },
      },
    })

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustA, idCustB, idAgent] },
      },
    })

    await prisma.$disconnect()

    // Stop server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  describe("Empty Queue", () => {
    test("4. AGENT receives HTTP 200 with an empty array when no tickets exist", async () => {
      // Ensure all tickets are cleaned before checking empty queue
      await prisma.ticket.deleteMany({})

      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse
      assert.deepStrictEqual(data, { tickets: [] })
    })
  })

  describe("Populated Queue", () => {
    before(async () => {
      // Create tickets for Customer A (tA1 older, tA2 newer)
      const tA1 = await prisma.ticket.create({
        data: {
          title: "Alpha Ticket 1 (Older)",
          description: "Alpha issue details",
          status: "OPEN",
          priority: "LOW",
          category: "OTHER",
          customerId: idCustA,
          createdAt: new Date(Date.now() - 20000), // 20s ago
        },
      })
      ticketA1Id = tA1.id

      const tA2 = await prisma.ticket.create({
        data: {
          title: "Alpha Ticket 2 (Newer)",
          description: "Alpha second issue details",
          status: "OPEN",
          priority: "LOW",
          category: "OTHER",
          customerId: idCustA,
          createdAt: new Date(Date.now() - 10000), // 10s ago
        },
      })
      ticketA2Id = tA2.id

      // Create ticket for Customer B (newest)
      const tB1 = await prisma.ticket.create({
        data: {
          title: "Beta Ticket 1 (Newest)",
          description: "Beta issue details",
          status: "OPEN",
          priority: "LOW",
          category: "OTHER",
          customerId: idCustB,
          createdAt: new Date(), // Now
        },
      })
      ticketB1Id = tB1.id
    })

    test("1 & 2. AGENT receives HTTP 200 and sees tickets from multiple customers (Alpha and Beta)", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse

      assert.ok(Array.isArray(data.tickets), "Response must have tickets array")
      // Agent must see tickets from Customer A and Customer B
      const ticketIds = data.tickets.map((t) => t.id)
      assert.ok(ticketIds.includes(ticketA1Id), "Agent queue must include Customer A ticket 1")
      assert.ok(ticketIds.includes(ticketA2Id), "Agent queue must include Customer A ticket 2")
      assert.ok(ticketIds.includes(ticketB1Id), "Agent queue must include Customer B ticket 1")

      const customerIds = new Set(data.tickets.map((t) => t.customerId))
      assert.ok(customerIds.has(idCustA), "Queue must contain Customer A's tickets")
      assert.ok(customerIds.has(idCustB), "Queue must contain Customer B's tickets")
    })

    test("3. Response contains safe ticket fields with correct types", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse
      const ticket = data.tickets.find((t) => t.id === ticketB1Id)
      assert.ok(ticket, "Target ticket must be in results")

      assert.strictEqual(ticket.id, ticketB1Id)
      assert.strictEqual(ticket.title, "Beta Ticket 1 (Newest)")
      assert.strictEqual(ticket.description, "Beta issue details")
      assert.strictEqual(ticket.status, "OPEN")
      assert.strictEqual(ticket.priority, "LOW")
      assert.strictEqual(ticket.category, "OTHER")
      assert.strictEqual(ticket.customerId, idCustB)
      assert.strictEqual(ticket.agentId, null)
      assert.ok(ticket.createdAt)
      assert.ok(ticket.updatedAt)
    })

    test("Sorting: Tickets are ordered newest first (createdAt DESC)", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse

      // Check descending createdAt order for our test tickets
      const ourTickets = data.tickets.filter((t) =>
        [ticketA1Id, ticketA2Id, ticketB1Id].includes(t.id)
      )
      assert.strictEqual(ourTickets[0].id, ticketB1Id, "Newest ticket (tB1) should come first")
      assert.strictEqual(ourTickets[1].id, ticketA2Id, "Middle ticket (tA2) should come second")
      assert.strictEqual(ourTickets[2].id, ticketA1Id, "Oldest ticket (tA1) should come third")

      const t0 = new Date(ourTickets[0].createdAt).getTime()
      const t1 = new Date(ourTickets[1].createdAt).getTime()
      const t2 = new Date(ourTickets[2].createdAt).getTime()
      assert.ok(t0 >= t1 && t1 >= t2, "Timestamps must be descending")
    })

    test("5. CUSTOMER receives ONLY their own tickets on GET /api/tickets", async () => {
      const resCustA = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustA}`,
        },
      })

      assert.strictEqual(resCustA.status, 200)
      const dataCustA = (await resCustA.json()) as TicketListResponse

      assert.strictEqual(dataCustA.tickets.length, 2)
      for (const ticket of dataCustA.tickets) {
        assert.strictEqual(ticket.customerId, idCustA)
      }
    })

    test("6. Customer A cannot see Customer B's tickets", async () => {
      const resCustA = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustA}`,
        },
      })

      assert.strictEqual(resCustA.status, 200)
      const dataCustA = (await resCustA.json()) as TicketListResponse

      for (const ticket of dataCustA.tickets) {
        assert.notStrictEqual(ticket.customerId, idCustB)
        assert.notStrictEqual(ticket.id, ticketB1Id)
      }
    })

    test("7. Missing Authorization header returns HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
      })

      assert.strictEqual(res.status, 401)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Authentication required")
    })

    test("8. Invalid JWT returns HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid.jwt.signature",
        },
      })

      assert.strictEqual(res.status, 401)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Authentication required")
    })

    test("9. Client-supplied customerId in query parameter cannot alter the agent queue", async () => {
      // AGENT passes ?customerId=... in query param - should still return all tickets
      const res = await fetch(`${baseUrl}/api/tickets?customerId=${idCustA}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse

      // Must still contain Customer B's ticket despite query param
      const ticketIds = data.tickets.map((t) => t.id)
      assert.ok(ticketIds.includes(ticketB1Id), "Agent queue ignores ?customerId query param")
      assert.ok(ticketIds.includes(ticketA1Id))
      assert.ok(ticketIds.includes(ticketA2Id))
    })

    test("10. Response contains no passwords, hashes, or unrelated user fields", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as TicketListResponse

      for (const ticket of data.tickets) {
        assert.strictEqual("password" in ticket, false)
        assert.strictEqual("passwordHash" in ticket, false)
        assert.strictEqual("user" in ticket, false)
        assert.strictEqual("customer" in ticket, false)
        assert.strictEqual("agent" in ticket, false)
      }
    })

    test("11. Existing ticket creation still works for CUSTOMER", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustA}`,
        },
        body: JSON.stringify({
          title: "Newly Created Ticket For Alpha",
          description: "Checking that customer creation works alongside agent queue",
        }),
      })

      assert.strictEqual(res.status, 201)
      const newTicket = (await res.json()) as TicketResponse
      assert.strictEqual(newTicket.title, "Newly Created Ticket For Alpha")
      assert.strictEqual(newTicket.customerId, idCustA)

      // Verify agent queue now immediately includes this new ticket
      const agentRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      const agentData = (await agentRes.json()) as TicketListResponse
      const found = agentData.tickets.some((t) => t.id === newTicket.id)
      assert.ok(found, "Agent queue must include newly created ticket")
    })

    test("12. Existing ticket details work for CUSTOMER and AGENT", async () => {
      // Customer A can view their own ticket
      const custRes = await fetch(`${baseUrl}/api/tickets/${ticketA1Id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustA}`,
        },
      })

      assert.strictEqual(custRes.status, 200)
      const custTicket = (await custRes.json()) as TicketResponse
      assert.strictEqual(custTicket.id, ticketA1Id)

      // AGENT can view the ticket details as well
      const agentRes = await fetch(`${baseUrl}/api/tickets/${ticketA1Id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(agentRes.status, 200)
      const agentTicket = (await agentRes.json()) as TicketResponse
      assert.strictEqual(agentTicket.id, ticketA1Id)
    })
  })
})
