let refreshInFlight: Promise<Response> | null = null;

function refreshSession(): Promise<Response> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const requestInit: RequestInit = { ...init, credentials: 'include' };
  const response = await fetch(input, requestInit);
  if (response.status !== 401) return response;

  const refreshed = await refreshSession();
  if (!refreshed.ok) return response;
  return fetch(input, requestInit);
}
