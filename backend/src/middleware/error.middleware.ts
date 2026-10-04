import { Request, Response, NextFunction } from "express"

export class AppError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    })
    return
  }

  // Handle Prisma unique constraint violation (P2002) as duplicate conflict
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  ) {
    res.status(409).json({
      error: "Email already in use",
    })
    return
  }

  // Generic internal server error (do not leak stack trace or internal DB details)
  console.error(
    "Unhandled server error:",
    err instanceof Error ? err.message : "Internal error"
  )

  res.status(500).json({
    error: "Internal server error",
  })
}
