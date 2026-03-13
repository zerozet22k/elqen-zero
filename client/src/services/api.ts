const API_URL =
  import.meta.env.REACT_APP_API_URL ?? "http://localhost:4000";

type Query = Record<string, string | number | boolean | undefined | null>;

const buildUrl = (path: string, query?: Query) => {
  const url = new URL(path, API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  query?: Query
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}
