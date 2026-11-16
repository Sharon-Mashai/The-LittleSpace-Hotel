const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

type ApiOptions = {
  method?: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers = new Headers();

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let requestBody: BodyInit | undefined;

  if (options.body instanceof FormData) {
    requestBody = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
    method: options.method ?? "GET",
    headers,
    body: requestBody,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data as T;
}
