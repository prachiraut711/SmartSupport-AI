import { Request, Response, NextFunction } from "express"
import * as authService from "../services/auth.service"

/**
 * Handles user registration requests.
 * POST /api/auth/register
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, role } = req.body

    const safeUser = await authService.register({
      name,
      email,
      password,
      role,
    })

    res.status(201).json(safeUser)
  } catch (error) {
    next(error)
  }
}

/**
 * Handles user login requests.
 * POST /api/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body

    const loginResponse = await authService.login({
      email,
      password,
    })

    res.status(200).json(loginResponse)
  } catch (error) {
    next(error)
  }
}
