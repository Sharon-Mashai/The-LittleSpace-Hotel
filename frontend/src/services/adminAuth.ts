import { apiRequest } from "./api";

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  created_at: string;
};

type AdminAuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AdminUser;
};

const ADMIN_TOKEN_KEY = "littlespace_admin_token";
const ADMIN_USER_KEY = "littlespace_admin_user";

function saveAdminAuthentication(response: AdminAuthResponse): AdminUser {
  localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(response.user));

  return response.user;
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AdminUser> {
  const response = await apiRequest<AdminAuthResponse>("/admin/auth/login", {
    method: "POST",
    body: { email, password },
  });

  if (response.user.role !== "admin") {
    throw new Error("Administrator access is required.");
  }

  return saveAdminAuthentication(response);
}

export function getAdminAuthToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getLoggedInAdmin(): AdminUser | null {
  const storedUser = localStorage.getItem(ADMIN_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as AdminUser;

    if (user.role !== "admin") {
      localStorage.removeItem(ADMIN_USER_KEY);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}
