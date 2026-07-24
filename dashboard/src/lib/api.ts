import { clearToken, getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Expired/invalid JWT: bounce to login instead of leaving a raw error message
  // on whatever page the user happened to be on. Skip this for the auth
  // endpoints themselves — a wrong OTP is a 401 too, and that should surface as
  // a form error, not a redirect loop back to the page it's already on.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    clearToken();
    if (typeof window !== 'undefined') window.location.assign('/login');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body && (body.message as string)) || res.statusText;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }
  return body as T;
}

export const api = {
  requestOtp: (phoneNumber: string) =>
    request<{ sent: true }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phoneNumber }) }),
  verifyOtp: (phoneNumber: string, code: string) =>
    request<{ accessToken: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, code }),
    }),

  getRegistrants: (limit = 50, offset = 0) =>
    request<Paginated<Registrant>>(`/dashboard/registrants?limit=${limit}&offset=${offset}`),
  evaluateMatch: (phoneA: string, phoneB: string) =>
    request<EligibilityResult>('/dashboard/matches/evaluate', {
      method: 'POST',
      body: JSON.stringify({ phoneA, phoneB }),
    }),
  proposeMatch: (phoneA: string, phoneB: string) =>
    request<{ id: string }>('/dashboard/matches/propose', {
      method: 'POST',
      body: JSON.stringify({ phoneA, phoneB }),
    }),
  getMatches: (limit = 50, offset = 0) =>
    request<Paginated<MatchRow>>(`/dashboard/matches?limit=${limit}&offset=${offset}`),
  getRewards: (limit = 50, offset = 0) =>
    request<RewardsResponse>(`/dashboard/rewards?limit=${limit}&offset=${offset}`),
  getActivity: (limit = 50) => request<ActivityResponse>(`/dashboard/activity?limit=${limit}`),
};

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Registrant {
  id: string;
  name: string | null;
  phoneNumber: string;
  intentType: string;
  lga: string | null;
  ageBracket: string | null;
  consentStatus: string;
  status: string;
  needsAction: boolean;
}

export type EligibilityResult =
  | { ok: true; userA: Registrant; userB: Registrant; summary: string }
  | { ok: false; reason: 'not_found' | 'ineligible' };

export interface MatchRow {
  id: string;
  status: string;
  userAName: string | null;
  userBName: string | null;
  scheduledCallTime: string | null;
  callCompleted: boolean;
  createdAt: string;
}

export interface RewardsResponse {
  totalRewardsEarned: number;
  transactions: Paginated<{ id: string; amount: number; createdAt: string; atTransactionId: string | null }>;
}

export type ActivityChannel = 'ussd' | 'sms' | 'voice' | 'airtime';

export interface ActivityEvent {
  id: string;
  channel: ActivityChannel;
  direction: 'inbound' | 'outbound';
  summary: string;
  phoneNumber?: string;
  timestamp: string;
}

export interface ActivityResponse {
  events: ActivityEvent[];
  counts: Record<ActivityChannel, number>;
}
