import { corsHeaders } from './cors.ts'

/**
 * Create a JSON response with CORS headers.
 *
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON body and CORS headers
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Create an error response with CORS headers.
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @returns Response object with error JSON and CORS headers
 */
export function errorResponse(message: string, status: number = 500): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}
