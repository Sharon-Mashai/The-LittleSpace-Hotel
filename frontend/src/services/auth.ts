import { apiRequest } from "./api";

export type UserRole = "guest" | "admin" | "super_admin";

export type AuthenticatedUser = {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
};

// Kept for compatibility with existing guest pages.
export type GuestUser = AuthenticatedUser;

type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthenticatedUser;
};

type PasswordResetResponse = {
  success: boolean;
  message: string;
};

const TOKEN_KEY = "littlespace_token";
const USER_KEY = "littlespace_user";

// Save the shared authentication session.
function saveAuthentication(response: AuthResponse): AuthenticatedUser {
  localStorage.setItem(TOKEN_KEY, response.token);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));

  return response.user;
}

// Shared login for guests, admins and Super Admin.
export async function loginUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  return saveAuthentication(response);
}

// Register a new guest account.
export async function registerGuest(
  fullName: string,
  email: string,
  password: string,
  phone: string,
): Promise<AuthenticatedUser> {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: { fullName, email, password, phone },
  });

  return saveAuthentication(response);
}

// Request a password reset email for a guest.
export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetResponse> {
  return apiRequest<PasswordResetResponse>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

// Reset a guest password using the token from the email link.
export async function resetGuestPassword(
  token: string,
  password: string,
): Promise<PasswordResetResponse> {
  return apiRequest<PasswordResetResponse>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}

// Get the shared authentication token.
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Get the currently logged-in user, regardless of role.
export function getLoggedInUser(): AuthenticatedUser | null {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as AuthenticatedUser;

    if (!user || !["guest", "admin", "super_admin"].includes(user.role)) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

// Get the logged-in guest for existing guest-only pages.
export function getLoggedInGuest(): GuestUser | null {
  const user = getLoggedInUser();

  if (!user || user.role !== "guest") {
    return null;
  }

  return user;
}

export function logoutUser(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function logoutGuest(): void {
  logoutUser();
}

export async function loginGuest(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  return loginUser(email, password);
}
