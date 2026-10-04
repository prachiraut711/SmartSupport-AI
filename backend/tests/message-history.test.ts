import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { MessageResponse, MessageListResponse } from "../src/types/message.types"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Ticket Message History (GET /api/tickets/:ticketId/messages)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "hist.custA@example.com"
  const emailCustB = "hist.custB@example.com"
  const emailAgentA = "hist.agentA@example.com"
  const emailAgentB = "hist.agentB@example.com"

  let idCustA: string
  let idCustB: string
  let idAgentA: string
  let idAgentB: string

  let tokenCustA: string
  let tokenCustB: string
  let tokenAgentA: string
  let tokenAgentB: string

  let ticketAId: string
  let ticketBId: string
  let emptyTicketId: string

  let msg1Id: string
  let msg2Id: string
  let msg3Id: string

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustA, emailCustB, emailAgentA, emailAgentB]
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

    const agentA = await prisma.user.create({
      data: { name: "Agent Alpha", email: emailAgentA, password: passwordHash, role: "AGENT" },
    })
    idAgentA = agentA.id
    tokenAgentA = signToken({ userId: idAgentA, role: "AGENT" })

    const agentB = await prisma.user.create({
      data: { name: "Agent Beta", email: emailAgentB, password: passwordHash, role: "AGENT" },
    })
    idAgentB = agentB.id
    tokenAgentB = signToken({ userId: idAgentB, role: "AGENT" })

    // 3. Create Ticket A belonging to Customer A (assigned to Agent B)
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Alpha Ticket With Messages",
        description: "Ticket with 3 chronological messages",
        status: "OPEN",
        priority: "LOW",
        category: "TECHNICAL",
        customerId: idCustA,
        agentId: idAgentB,
      },
    })
    ticketAId = ticketA.id

    // 4. Create Ticket B belonging to Customer B (unassigned)
    const ticketB = await prisma.ticket.create({
      data: {
        title: "Beta Private Ticket",
        description: "Customer B ticket",
        status: "OPEN",
        priority: "MEDIUM",
        category: "BILLING",
        customerId: idCustB,
        agentId: null,
      },
    })
    ticketBId = ticketB.id

    // 5. Create Empty Ticket belonging to Customer A (no messages)
    const emptyTicket = await prisma.ticket.create({
      data: {
        title: "Alpha Empty Ticket",
        description: "Ticket with zero messages",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustA,
        agentId: null,
      },
    })
    emptyTicketId = emptyTicket.id

    // 6. Create 3 chronological messages on Ticket A
    const m1 = await prisma.message.create({
      data: {
        content: "Message 1 (First/Oldest)",
        ticketId: ticketAId,
        senderId: idCustA,
        isInternal: false,
        createdAt: new Date(Date.now() - 30000), // 30s ago
      },
    })
    msg1Id = m1.id

    const m2 = await prisma.message.create({
      data: {
        content: "Message 2 (Second/Middle)",
        ticketId: ticketAId,
        senderId: idAgentB,
        isInternal: false,
        createdAt: new Date(Date.now() - 15000), // 15s ago
      },
    })
    msg2Id = m2.id

    const m3 = await prisma.message.create({
      data: {
        content: "Message 3 (Third/Newest)",
        ticketId: ticketAId,
        senderId: idCustA,
        isInternal: false,
        createdAt: new Date(), // Now
      },
    })
    msg3Id = m3.id

    // 7. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    const allEmails = [emailCustA, emailCustB, emailAgentA, emailAgentB]
    await prisma.message.deleteMany({
      where: {
        sender: { email: { in: allEmails } },
      },
    })
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [idCustA, idCustB, idAgentA, idAgentB] },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustA, idCustB, idAgentA, idAgentB] },
      },
    })

    await prisma.$disconnect()

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1, 9, 11 & 13. Customer can retrieve messages from own ticket -> 200, oldest first, safe fields, no body required", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as MessageListResponse
    assert.ok(Array.isArray(data.messages), "Response must have messages array")
    assert.strictEqual(data.messages.length, 3, "Must return exactly 3 messages")

    // 9. Chronological order verification (oldest -> newest)
    assert.strictEqual(data.messages[0].id, msg1Id)
    assert.strictEqual(data.messages[0].content, "Message 1 (First/Oldest)")
    assert.strictEqual(data.messages[1].id, msg2Id)
    assert.strictEqual(data.messages[1].content, "Message 2 (Second/Middle)")
    assert.strictEqual(data.messages[2].id, msg3Id)
    assert.strictEqual(data.messages[2].content, "Message 3 (Third/Newest)")

    const t0 = new Date(data.messages[0].createdAt).getTime()
    const t1 = new Date(data.messages[1].createdAt).getTime()
    const t2 = new Date(data.messages[2].createdAt).getTime()
    assert.ok(t0 <= t1 && t1 <= t2, "Messages must be ordered chronologically ascending")

    // 11. Safe fields only
    for (const msg of data.messages) {
      assert.ok(msg.id)
      assert.ok(msg.content)
      assert.strictEqual(msg.ticketId, ticketAId)
      assert.ok(msg.senderId)
      assert.strictEqual(typeof msg.isInternal, "boolean")
      assert.ok(msg.createdAt)

      assert.strictEqual("password" in msg, false)
      assert.strictEqual("passwordHash" in msg, false)
      assert.strictEqual("user" in msg, false)
      assert.strictEqual("sender" in msg, false)
      assert.strictEqual("ticket" in msg, false)
    }
  })

  test("2. Customer cannot retrieve another customer's ticket messages -> 404", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("3, 4 & 14. Agent can retrieve any ticket messages even when not assigned -> 200, no body required", async () => {
    // Ticket A is assigned to Agent B, Agent A retrieves it
    const resA = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.strictEqual(resA.status, 200)
    const dataA = (await resA.json()) as MessageListResponse
    assert.strictEqual(dataA.messages.length, 3)

    // Ticket B is unassigned, Agent A retrieves it
    const resB = await fetch(`${baseUrl}/api/tickets/${ticketBId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.strictEqual(resB.status, 200)
    const dataB = (await resB.json()) as MessageListResponse
    assert.deepStrictEqual(dataB.messages, [])
  })

  test("5. Nonexistent ticket -> 404", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000"

    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgentA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("6. Invalid ticket UUID -> 400", async () => {
    const invalidIds = ["123", "not-a-valid-uuid", "12345678-1234-1234-1234"]

    for (const invalidId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}/messages`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustA}`,
        },
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("7. Missing Authorization header -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("8. Invalid JWT -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid.jwt.value",
      },
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("10. Empty ticket returns { messages: [] } with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${emptyTicketId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as MessageListResponse
    assert.deepStrictEqual(data, { messages: [] })
  })

  test("12. Query parameter cannot bypass customer ownership", async () => {
    // Customer A attempts to spoof ownership of Customer B's ticket via query parameter
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}/messages?customerId=${idCustA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("15. Existing POST message creation still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${emptyTicketId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "First message on empty ticket",
      }),
    })

    assert.strictEqual(res.status, 201)
    const msg = (await res.json()) as MessageResponse
    assert.strictEqual(msg.content, "First message on empty ticket")

    // Fetch history and verify it now has 1 message
    const historyRes = await fetch(`${baseUrl}/api/tickets/${emptyTicketId}/messages`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    const historyData = (await historyRes.json()) as MessageListResponse
    assert.strictEqual(historyData.messages.length, 1)
    assert.strictEqual(historyData.messages[0].id, msg.id)
  })

  test("16 & 17. Existing customer & agent ticket listing still work", async () => {
    const custRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)
    const custData = (await custRes.json()) as TicketListResponse
    assert.ok(custData.tickets.every((t) => t.customerId === idCustA))

    const agentRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenAgentA}` },
    })
    assert.strictEqual(agentRes.status, 200)
    const agentData = (await agentRes.json()) as TicketListResponse
    assert.ok(agentData.tickets.length >= 2)
  })

  test("18. Existing ticket details still work", async () => {
    const custRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)

    const custOtherRes = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custOtherRes.status, 404)
  })

  test("19. Existing ticket update still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.status, "RESOLVED")
  })

  test("20. Existing ticket assignment still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.agentId, idAgentA)
  })
})
