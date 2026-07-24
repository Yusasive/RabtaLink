const TOKEN_KEY = 'rabtalink_dashboard_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export interface AgentTokenPayload {
  sub: string;
  phoneNumber: string;
  exp: number;
}

/** Client-side only — for display/expiry checks, never trusted as verification. */
export function decodeToken(token: string): AgentTokenPayload | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload)) as AgentTokenPayload;
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}
