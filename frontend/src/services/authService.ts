import { apiRequest } from "./api"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: "CUSTOMER" | "AGENT"
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface RegisterDTO {
  name: string
  email: string
  password: string
  role: "CUSTOMER" | "AGENT"
}

export async function login(credentials: { email: string; password: string }): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  })

  if (data?.token) {
    localStorage.setItem("token", data.token)
  }
  if (data?.user) {
    localStorage.setItem("user", JSON.stringify(data.user))
  }

  return data
}

export async function register(userData: RegisterDTO): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  })
}

export function logout(): void {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("user")
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}
