/**
 * Typed fetch helpers for dashboard API calls.
 */

export interface ApiErrorBody {
  error: string;
  code?: string;
  action?: string;
  issues?: Array<{
    code: string;
    title: string;
    message: string;
    action: string;
    severity: string;
  }>;
  rateLimit?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || `Request failed (${status})`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    throw new ApiRequestError(response.status, data as ApiErrorBody);
  }
  return data as T;
}
