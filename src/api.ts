// ==========================================
// WSPÓLNA KONFIGURACJA KOMUNIKACJI Z BACKENDEM
// ==========================================
// Adres API ustawiamy w pliku .env (VITE_API_URL), domyślnie lokalny serwer Node.js
// z katalogu backend/ (PORT=3000, wszystkie trasy pod /api).

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Wywołanie REST API z obsługą JSON i czytelnym komunikatem błędu.
 * Backend zwraca błędy w formacie { message: string } (middleware errorHandler).
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new ApiError(0, 'Brak połączenia z serwerem API.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `Błąd serwera (HTTP ${response.status}).`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}
