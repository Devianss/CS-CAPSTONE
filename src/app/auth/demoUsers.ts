import type { ElectronRole } from "../../types/electron";

/**
 * demoUsers.ts
 *
 * Hard-coded demo accounts for the thesis defense sprint. Replaces
 * a real auth provider (Cognito) until Phase 2 of the thesis timeline.
 *
 * Adding a new account: append to DEMO_USERS. Roles are constrained
 * to ElectronRole from src/types/electron.d.ts so renaming propagates.
 */

export interface DemoUser {
  email: string;
  password: string;
  role: ElectronRole;
  displayName: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@runa.edu.ph",
    password: "admin",
    role: "admin",
    displayName: "System Administrator",
  },
  {
    email: "student@runa.edu.ph",
    password: "runa-student",
    role: "student",
    displayName: "John Doe",
  },
  {
    email: "casio@runa.edu.ph",
    password: "1",
    role: "student",
    displayName: "Gen Benedict Casio",
  },
  {
    email: "grospe@runa.edu.ph",
    password: "1",
    role: "student",
    displayName: "Neil Christian Grospe",
  },
  {
    email: "iledan@runa.edu.ph",
    password: "1",
    role: "student",
    displayName: "John Benedict Iledan",
  },
  {
    email: "pardinas@runa.edu.ph",
    password: "1",
    role: "student",
    displayName: "Markjay Pardinas",
  },
];

/**
 * Authenticate by email + password. Returns the matched user or null.
 * Email comparison is case-insensitive and trimmed; password is exact match.
 */
export function authenticate(email: string, password: string): DemoUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    DEMO_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password,
    ) ?? null
  );
}

/**
 * Look up a demo user by email (no password check). Used by the
 * SessionGuard / dashboards to recover the displayName for a stored session.
 */
export function findDemoUser(email: string): DemoUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email.toLowerCase() === normalizedEmail) ?? null;
}
