const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Standard typed HTTP client with bearer token injection from localStorage
 * and user-friendly error normalization.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const token = localStorage.getItem("token")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let serverError: string | null = null
      try {
        const errorData = await response.json()
        if (errorData && typeof errorData.error === "string") {
          serverError = errorData.error
        } else if (errorData && typeof errorData.message === "string") {
          serverError = errorData.message
        }
      } catch {
        // Response is not JSON
      }

      let errorMessage = serverError || response.statusText || `Request failed with status ${response.status}`

      // Sanitize and normalize messages based on HTTP status code
      if (response.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        if (!serverError || serverError.toLowerCase().includes("token") || serverError.toLowerCase().includes("jwt")) {
          errorMessage = "Authentication required. Please sign in to continue."
        }
      } else if (response.status === 403) {
        if (!serverError) {
          errorMessage = "Forbidden: you do not have permission to access this resource."
        }
      } else if (response.status === 404) {
        if (!serverError) {
          errorMessage = "Resource not found."
        }
      } else if (response.status === 502) {
        errorMessage = serverError || "Upstream service response was invalid. Please try again."
      } else if (response.status === 503) {
        errorMessage = serverError || "Service is temporarily unavailable. Please try again shortly."
      } else if (response.status >= 500) {
        errorMessage = "A server error occurred. Please try again later."
      }

      throw new ApiError(errorMessage, response.status)
    }

    return (await response.json()) as T
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err
    }
    const message = err instanceof Error ? err.message : "Network error"
    throw new ApiError(message, 0)
  }
}
