import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ApiError extends Error {
  status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)

    this.name = 'ApiError'
    this.status = status
  }
}
