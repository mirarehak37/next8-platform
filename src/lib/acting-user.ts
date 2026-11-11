import { AsyncLocalStorage } from "node:async_hooks";

// Lets non-browser entry points (the MCP endpoint, authenticated by an API token) run the
// regular server actions as a specific user. Only server code can enter this context;
// requireSession() prefers it over the cookie session.
export type ActingUser = { id: string; tenantId: string; role: string; name: string; email: string; jobTitle?: string };

const store = new AsyncLocalStorage<ActingUser>();

export function runAsUser<T>(user: ActingUser, fn: () => Promise<T>) {
  return store.run(user, fn);
}

export function actingUser() {
  return store.getStore();
}
