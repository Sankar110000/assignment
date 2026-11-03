import type { ErrorHandler } from 'hono'
import { ApiError } from './ApiError'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: err.message,
      },
      err.status,
    )
  }

  console.error(err)

  return c.json(
    {
      success: false,
      error: 'Something went wrong',
    },
    500,
  )
}
