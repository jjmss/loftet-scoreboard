async function parseError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Feil ${res.status}`;
  } catch {
    return `Feil ${res.status}`;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}
