// Shared demo-account credentials, used by the Login page's "Try the demo
// account" button and to detect the demo account elsewhere (Dashboard
// greeting, auto-reset on login) so behavior stays consistent.
export const DEMO_EMAIL = "demo@notebuddy.app";
export const DEMO_PASSWORD = "Demo1234!";

export function isDemoUser(user) {
  return user?.email?.toLowerCase() === DEMO_EMAIL;
}
