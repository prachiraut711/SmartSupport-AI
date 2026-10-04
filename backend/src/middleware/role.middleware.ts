import { Request, Response, NextFunction } from "express"
import { Role } from "@prisma/client"
import { AppError } from "./error.middleware"

/**
 * Reusable role-based authorization middleware.
 *
 * 1. Reads req.user set by authenticateToken.
 * 2. If req.user or req.user.role is missing, returns HTTP 401 "Authentication required".
 * 3. If req.user.role matches allowed roles, allows request to proceed.
 * 4. If req.user.role does not match, returns HTTP 403 "Forbidden: insufficient permissions".
 */
export const requireRole = (allowedRoles: Role | Role[] | "CUSTOMER" | "AGENT" | ("CUSTOMER" | "AGENT")[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  return (req: Request, _res: Response, next: NextFunction): void => {
    // Missing authentication information
    if (!req.user || !req.user.role) {
      return next(new AppError("Authentication required", 401))
    }

    // Role check
    if (roles.includes(req.user.role)) {
      return next()
    }

    // Insufficient permissions
    return next(new AppError("Forbidden: insufficient permissions", 403))
  }
}

// Convenient helper middlewares
export const requireCustomer = requireRole("CUSTOMER")
export const requireAgent = requireRole("AGENT")

export default requireRole
