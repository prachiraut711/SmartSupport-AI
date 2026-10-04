import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  analyzeTicket,
  parseAndValidateAIResponse,
  stripCodeFences,
  extractJsonString,
  isTransientError,
} from "../src/services/gemini.service"
import { AppError } from "../src/middleware/error.middleware"
import {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS,
  TicketCategory,
  TicketPriority,
  Sentiment,
} from "../src/types/ai.types"

describe("Gemini AI Service Foundation", () => {
  const validBasePayload = {
    category: "TECHNICAL",
    priority: "HIGH",
    sentiment: "NEGATIVE",
    summary: "Customer is unable to log in to their account.",
    suggestedReply: "We apologize for the trouble. Please try resetting your password using the link.",
  }

  // 1. Valid AI JSON is parsed successfully
  test("1. Valid AI JSON is parsed successfully into structured AIAnalysisResult", () => {
    const raw = JSON.stringify(validBasePayload)
    const result = parseAndValidateAIResponse(raw)

    assert.equal(result.category, "TECHNICAL")
    assert.equal(result.priority, "HIGH")
    assert.equal(result.sentiment, "NEGATIVE")
    assert.equal(result.summary, validBasePayload.summary)
    assert.equal(result.suggestedReply, validBasePayload.suggestedReply)
  })

  // 2. Valid category is accepted
  test("2. All allowed categories are accepted", () => {
    for (const cat of ALLOWED_CATEGORIES) {
      const raw = JSON.stringify({ ...validBasePayload, category: cat })
      const result = parseAndValidateAIResponse(raw)
      assert.equal(result.category, cat)

      // Also verify lowercase normalization
      const rawLower = JSON.stringify({ ...validBasePayload, category: cat.toLowerCase() })
      const resultLower = parseAndValidateAIResponse(rawLower)
      assert.equal(resultLower.category, cat)
    }
  })

  // 3. Valid priority is accepted
  test("3. All allowed priorities are accepted", () => {
    for (const prio of ALLOWED_PRIORITIES) {
      const raw = JSON.stringify({ ...validBasePayload, priority: prio })
      const result = parseAndValidateAIResponse(raw)
      assert.equal(result.priority, prio)

      // Also verify lowercase normalization
      const rawLower = JSON.stringify({ ...validBasePayload, priority: prio.toLowerCase() })
      const resultLower = parseAndValidateAIResponse(rawLower)
      assert.equal(resultLower.priority, prio)
    }
  })

  // 4. Valid sentiment is accepted
  test("4. All allowed sentiments are accepted", () => {
    for (const sent of ALLOWED_SENTIMENTS) {
      const raw = JSON.stringify({ ...validBasePayload, sentiment: sent })
      const result = parseAndValidateAIResponse(raw)
      assert.equal(result.sentiment, sent)

      // Also verify lowercase normalization
      const rawLower = JSON.stringify({ ...validBasePayload, sentiment: sent.toLowerCase() })
      const resultLower = parseAndValidateAIResponse(rawLower)
      assert.equal(resultLower.sentiment, sent)
    }
  })

  // 5. Empty summary is rejected
  test("5. Empty summary is rejected with controlled AppError (502)", () => {
    const emptySummaries = ["", "   ", "\n\t"]
    for (const s of emptySummaries) {
      const raw = JSON.stringify({ ...validBasePayload, summary: s })
      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 6. Empty suggestedReply is rejected
  test("6. Empty suggestedReply is rejected with controlled AppError (502)", () => {
    const emptyReplies = ["", "   ", "\n\t"]
    for (const r of emptyReplies) {
      const raw = JSON.stringify({ ...validBasePayload, suggestedReply: r })
      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 7. Invalid category is rejected
  test("7. Invalid category is rejected with controlled AppError (502)", () => {
    const invalidCategories = ["UNKNOWN", "GENERAL", "SALES", "BUG", ""]
    for (const cat of invalidCategories) {
      const raw = JSON.stringify({ ...validBasePayload, category: cat })
      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 8. Invalid priority is rejected
  test("8. Invalid priority is rejected with controlled AppError (502)", () => {
    const invalidPriorities = ["CRITICAL", "NORMAL", "EXTREME", "P1", ""]
    for (const prio of invalidPriorities) {
      const raw = JSON.stringify({ ...validBasePayload, priority: prio })
      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 9. Invalid sentiment is rejected
  test("9. Invalid sentiment is rejected with controlled AppError (502)", () => {
    const invalidSentiments = ["HAPPY", "ANGRY", "FRUSTRATED", "NEUTRAL_POSITIVE", ""]
    for (const sent of invalidSentiments) {
      const raw = JSON.stringify({ ...validBasePayload, sentiment: sent })
      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 10. Missing required response fields are rejected
  test("10. Missing required response fields are rejected with controlled AppError (502)", () => {
    const fields = ["category", "priority", "sentiment", "summary", "suggestedReply"] as const

    for (const field of fields) {
      const incomplete = { ...validBasePayload }
      delete (incomplete as any)[field]
      const raw = JSON.stringify(incomplete)

      assert.throws(
        () => parseAndValidateAIResponse(raw),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        },
        `Expected rejection when missing ${field}`
      )
    }
  })

  // 11. Markdown code fences can be safely handled if returned
  test("11. Markdown code fences (```json ... ``` and ``` ... ```) are safely handled", () => {
    const jsonStr = JSON.stringify(validBasePayload, null, 2)
    const fencedWithJson = `\`\`\`json\n${jsonStr}\n\`\`\``
    const fencedWithoutJson = `\`\`\`\n${jsonStr}\n\`\`\``
    const fencedWithWhitespace = `\n\n  \`\`\`json\n${jsonStr}\n\`\`\`  \n`

    const res1 = parseAndValidateAIResponse(fencedWithJson)
    assert.equal(res1.category, "TECHNICAL")
    assert.equal(res1.summary, validBasePayload.summary)

    const res2 = parseAndValidateAIResponse(fencedWithoutJson)
    assert.equal(res2.category, "TECHNICAL")

    const res3 = parseAndValidateAIResponse(fencedWithWhitespace)
    assert.equal(res3.category, "TECHNICAL")
  })

  // 12. Malformed JSON is rejected
  test("12. Malformed JSON is rejected with controlled AppError (502)", () => {
    const malformedInputs = [
      "{ category: TECHNICAL, unquoted }",
      "Just plain text without JSON",
      "{ \"category\": \"TECHNICAL\", ",
      "",
      "   ",
      "null",
      "true",
      "123",
      "[]",
    ]

    for (const input of malformedInputs) {
      assert.throws(
        () => parseAndValidateAIResponse(input),
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 502)
          assert.equal(err.message, "AI returned an invalid analysis")
          return true
        }
      )
    }
  })

  // 13. Missing GEMINI_API_KEY is handled safely
  test("13. Missing GEMINI_API_KEY is handled safely with controlled AppError (500)", async () => {
    const originalKey = process.env.GEMINI_API_KEY

    try {
      // Test when undefined
      delete process.env.GEMINI_API_KEY
      await assert.rejects(
        async () => {
          await analyzeTicket("Login issue", "Cannot sign in to portal")
        },
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 500)
          assert.equal(err.message, "Gemini API key is not configured")
          return true
        }
      )

      // Test when placeholder
      process.env.GEMINI_API_KEY = "your_gemini_api_key_here"
      await assert.rejects(
        async () => {
          await analyzeTicket("Login issue", "Cannot sign in to portal")
        },
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 500)
          assert.equal(err.message, "Gemini API key is not configured")
          return true
        }
      )

      // Test when empty string
      process.env.GEMINI_API_KEY = "   "
      await assert.rejects(
        async () => {
          await analyzeTicket("Login issue", "Cannot sign in to portal")
        },
        (err: unknown) => {
          assert(err instanceof AppError)
          assert.equal(err.statusCode, 500)
          assert.equal(err.message, "Gemini API key is not configured")
          return true
        }
      )
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      } else {
        delete process.env.GEMINI_API_KEY
      }
    }
  })

  // 14. Gemini API failure is converted to a controlled error
  test("14. Gemini API failure (network, rate limit, quota) is converted to controlled AppError (503)", async () => {
    const mockClient = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          throw new Error("503 Service Unavailable: Model is overloaded")
        },
      }),
    } as any

    await assert.rejects(
      async () => {
        await analyzeTicket("Login issue", "Cannot access system", { client: mockClient })
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        assert.equal(err.statusCode, 503)
        assert.equal(err.message, "AI service temporarily unavailable")
        return true
      }
    )
  })

  // 15. API key is never included in returned error information
  test("15. API key is never included in returned error information or client responses", async () => {
    const secretKey = "AIzaSySecretApiKeyDoNotLeak"
    const mockClientWithSecretLeak = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          throw new Error(`Request failed for key ${secretKey}: 401 Unauthorized`)
        },
      }),
    } as any

    await assert.rejects(
      async () => {
        await analyzeTicket("Billing issue", "Invoice charge is incorrect", {
          client: mockClientWithSecretLeak,
        })
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        // Error message returned to caller must NOT contain the secret
        assert(!err.message.includes(secretKey))
        assert.equal(err.message, "AI service temporarily unavailable")
        return true
      }
    )
  })

  // 16. Mocked successful Gemini API response resolves end-to-end
  test("16. Mocked successful Gemini API response resolves cleanly with AIAnalysisResult", async () => {
    const mockClient = {
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: Promise.resolve({
            text: () => JSON.stringify(validBasePayload),
          }),
        }),
      }),
    } as any

    const result = await analyzeTicket("Login issue", "Cannot access portal", { client: mockClient })
    assert.equal(result.category, "TECHNICAL")
    assert.equal(result.priority, "HIGH")
    assert.equal(result.sentiment, "NEGATIVE")
    assert.equal(result.summary, validBasePayload.summary)
    assert.equal(result.suggestedReply, validBasePayload.suggestedReply)
  })

  // 17. Input validation: empty title or description rejected
  test("17. Input validation: empty title or description is rejected with AppError (400)", async () => {
    await assert.rejects(
      async () => {
        await analyzeTicket("", "Some valid description")
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        assert.equal(err.statusCode, 400)
        assert.equal(err.message, "Ticket title is required for AI analysis")
        return true
      }
    )

    await assert.rejects(
      async () => {
        await analyzeTicket("Valid Title", "")
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        assert.equal(err.statusCode, 400)
        assert.equal(err.message, "Ticket description is required for AI analysis")
        return true
      }
    )
  })

  // 18. isTransientError correctly identifies retryable vs permanent errors
  test("18. isTransientError accurately classifies temporary availability errors vs permanent errors", () => {
    // Retryable errors
    assert.equal(isTransientError(new Error("503 Service Unavailable")), true)
    assert.equal(isTransientError(new Error("The model is overloaded. Please try again later.")), true)
    assert.equal(isTransientError(new Error("Resource has been exhausted (e.g. check quota).")), true)
    assert.equal(isTransientError(new Error("fetch failed")), true)
    assert.equal(isTransientError(new Error("connect ECONNRESET 127.0.0.1:443")), true)
    assert.equal(isTransientError({ status: 503, message: "Service Unavailable" }), true)
    assert.equal(isTransientError({ status: 429, message: "Too Many Requests" }), true)
    assert.equal(isTransientError({ statusCode: 503 }), true)

    // Permanent errors (never retry)
    assert.equal(isTransientError(new AppError("Ticket title is required", 400)), false)
    assert.equal(isTransientError(new AppError("AI returned an invalid analysis", 502)), false)
    assert.equal(isTransientError(new Error("400 Bad Request: Invalid argument")), false)
    assert.equal(isTransientError(new Error("401 Unauthorized: Invalid API key")), false)
    assert.equal(isTransientError(new Error("404 Not Found")), false)
    assert.equal(isTransientError({ status: 400, message: "Invalid argument" }), false)
    assert.equal(isTransientError(null), false)
    assert.equal(isTransientError(undefined), false)
  })

  // 19. Gemini temporary 503 error retries and succeeds if subsequent attempt succeeds
  test("19. analyzeTicket retries on temporary 503 error and recovers when subsequent attempt succeeds", async () => {
    let callCount = 0
    const mockClient = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          callCount++
          if (callCount < 3) {
            throw new Error("503 Service Unavailable: High load on server")
          }
          return {
            response: Promise.resolve({
              text: () => JSON.stringify(validBasePayload),
            }),
          }
        },
      }),
    } as any

    const result = await analyzeTicket("Login issue", "Cannot access system", {
      client: mockClient,
      retryDelayMs: 10,
    })

    assert.equal(callCount, 3, "Expected exactly 3 calls (1 initial + 2 retries)")
    assert.equal(result.category, "TECHNICAL")
    assert.equal(result.priority, "HIGH")
    assert.equal(result.summary, validBasePayload.summary)
  })

  // 20. Gemini temporary 503 exhausts all retries and throws controlled 503 AppError
  test("20. analyzeTicket exhausts max retries on persistent 503 and throws controlled AppError (503)", async () => {
    let callCount = 0
    const mockClient = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          callCount++
          throw new Error("503 Service Unavailable: Service overloaded")
        },
      }),
    } as any

    await assert.rejects(
      async () => {
        await analyzeTicket("Login issue", "Cannot access system", {
          client: mockClient,
          retryDelayMs: 10,
        })
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        assert.equal(err.statusCode, 503)
        assert.equal(err.message, "AI service temporarily unavailable")
        return true
      }
    )

    assert.equal(callCount, 3, "Expected 1 initial attempt + 2 retries = 3 attempts total")
  })

  // 21. analyzeTicket does NOT retry on permanent 400 / invalid prompt errors
  test("21. analyzeTicket does NOT retry on non-transient client errors (e.g. 400 Bad Request)", async () => {
    let callCount = 0
    const mockClient = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          callCount++
          throw new Error("400 Bad Request: Invalid argument supplied")
        },
      }),
    } as any

    await assert.rejects(
      async () => {
        await analyzeTicket("Login issue", "Cannot access system", {
          client: mockClient,
          retryDelayMs: 10,
        })
      },
      (err: unknown) => {
        assert(err instanceof AppError)
        assert.equal(err.statusCode, 503)
        return true
      }
    )

    assert.equal(callCount, 1, "Must NOT retry on permanent client errors; exactly 1 attempt expected")
  })
})
