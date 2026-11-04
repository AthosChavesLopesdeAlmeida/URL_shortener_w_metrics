import { redirect } from "next/navigation";

export type ApiIssue = { path: (string | number)[]; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  body?: unknown;
  signal?: AbortSignal;
  /** Em 401, manda o usuário para /login. Desligue no próprio login. */
  redirectOn401?: boolean;
};

async function request<T>(
  method: string,
  path: string,
  { body, signal, redirectOn401 = true }: RequestOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin', // envia o cookie `sid` (mesma origem graças ao proxy)
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Unable to connect to the server');
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // O Nest devolve { message: string | string[], statusCode } e, na validação, também `issues`
  const data = (await res.json().catch(() => null)) as {
    message?: string | string[];
    issues?: ApiIssue[];
  } | null;
  const message = Array.isArray(data?.message) ? data.message.join(', ') : (data?.message ?? 'Unexpected error');

  if (res.status === 401 && redirectOn401 && typeof window !== 'undefined') {
    redirect('/login?expired=1');
  }

  throw new ApiError(res.status, message, data?.issues);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...opts, body }),
  // DELETE aceita body porque DELETE /api/account exige a senha
  delete: <T = void>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, { ...opts, body }),
};

/** Converte os `issues` do zod em { campo: mensagem } para exibir nos formulários */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.issues.map((i) => [String(i.path[0] ?? ''), i.message]));
}