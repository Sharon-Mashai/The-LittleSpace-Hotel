import { apiRequest } from "./api";

export type GuestUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  created_at: string;
};

type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: GuestUser;
};

const TOKEN_KEY = "littlespace_token";
const USER_KEY = "littlespace_user";

function saveAuthentication(response: AuthResponse): GuestUser {
  localStorage.setItem(TOKEN_KEY, response.token);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));

  return response.user;
}

export async function loginGuest(
  email: string,
  password: string,
): Promise<GuestUser> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  return saveAuthentication(response);
}

export async function registerGuest(
  fullName: string,
  email: string,
  password: string,
  phone: string,
): Promise<GuestUser> {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: { fullName, email, password, phone },
  });

  return saveAuthentication(response);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLoggedInGuest(): GuestUser | null {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as GuestUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function logoutGuest(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
