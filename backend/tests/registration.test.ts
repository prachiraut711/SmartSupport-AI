import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import bcrypt from "bcrypt"
import app from "../src/server"
import prisma from "../src/utils/prisma"

describe("User Registration (POST /api/auth/register)", () => {
  let server: Server
  let baseUrl: string
  const testCustomerEmail = "test.customer.reg@example.com"
  const testAgentEmail = "test.agent.reg@example.com"

  before(async () => {
    // Clean up any preexisting test records before test execution
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testCustomerEmail, testAgentEmail, "test.missing@example.com"],
        },
      },
    })

    // Start an ephemeral HTTP server on an available port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    // Clean up test records to avoid database pollution
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testCustomerEmail, testAgentEmail, "test.missing@example.com"],
        },
      },
    })
    await prisma.$disconnect()

    // Stop ephemeral HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1. Valid registration creates a user (CUSTOMER) with HTTP 201", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Prachi Customer",
        email: testCustomerEmail,
        password: "Password123!",
        role: "CUSTOMER",
      }),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as Record<string, unknown>

    assert.ok(data.id, "User ID must be returned")
    assert.strictEqual(data.name, "Prachi Customer")
    assert.strictEqual(data.email, testCustomerEmail)
    assert.strictEqual(data.role, "CUSTOMER")
    assert.ok(data.createdAt, "createdAt timestamp must be returned")
  })

  test("2. Password is stored as a bcrypt hash, not plaintext", async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: testCustomerEmail },
    })

    assert.ok(dbUser, "User must exist in the database")
    assert.notStrictEqual(
      dbUser.password,
      "Password123!",
      "Plaintext password must never be stored"
    )
    assert.ok(
      dbUser.password.startsWith("$2b$") || dbUser.password.startsWith("$2a$"),
      "Password must be hashed with bcrypt"
    )
    const isMatch = await bcrypt.compare("Password123!", dbUser.password)
    assert.strictEqual(
      isMatch,
      true,
      "Bcrypt hash must match original password"
    )
  })

  test("3. Response does not contain password or password hash", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Prachi Agent",
        email: testAgentEmail,
        password: "Password123!",
        role: "AGENT",
      }),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as Record<string, unknown>

    assert.strictEqual(
      "password" in data,
      false,
      "Response must not expose password"
    )
    assert.strictEqual(
      "passwordHash" in data,
      false,
      "Response must not expose passwordHash"
    )
    assert.strictEqual(
      "hash" in data,
      false,
      "Response must not expose hash"
    )
  })

  test("4. Duplicate email returns HTTP 409", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        email: testCustomerEmail, // already created in test 1
        password: "DifferentPassword123!",
        role: "CUSTOMER",
      }),
    })

    assert.strictEqual(res.status, 409)
    const data = (await res.json()) as Record<string, unknown>
    assert.ok(data.error, "Error message must be present in response")
  })

  test("5. Invalid role returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin User",
        email: "test.admin@example.com",
        password: "Password123!",
        role: "ADMIN",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /role/i)
  })

  test("6. Missing required fields returns HTTP 400", async () => {
    // Missing name
    const resNoName = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test.missing@example.com",
        password: "Password123!",
        role: "CUSTOMER",
      }),
    })
    assert.strictEqual(resNoName.status, 400)

    // Missing email
    const resNoEmail = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Email",
        password: "Password123!",
        role: "CUSTOMER",
      }),
    })
    assert.strictEqual(resNoEmail.status, 400)

    // Missing password
    const resNoPassword = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Password",
        email: "test.missing@example.com",
        role: "CUSTOMER",
      }),
    })
    assert.strictEqual(resNoPassword.status, 400)

    // Missing role
    const resNoRole = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Role",
        email: "test.missing@example.com",
        password: "Password123!",
      }),
    })
    assert.strictEqual(resNoRole.status, 400)
  })

  test("7. Malformed email returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Malformed Email User",
        email: "not-a-valid-email",
        password: "Password123!",
        role: "CUSTOMER",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /email/i)
  })
})
