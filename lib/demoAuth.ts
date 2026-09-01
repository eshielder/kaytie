/**
 * Demo auth: no real accounts — the "user" is just a display name kept in
 * sessionStorage, so state is naturally fresh per tab and fully cleared on
 * logout or when the tab closes.
 */
const KEY = "kt-demo-user";

export interface DemoUser {
  name: string;
}

export function getDemoUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoUser;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function demoLogin(name: string): DemoUser {
  const user: DemoUser = { name: name.trim().slice(0, 40) };
  sessionStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export function demoLogout(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
