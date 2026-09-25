import { supabase } from "./supabaseClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export async function getPushSubscriptionStatus() {
  if (!isPushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "disabled";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

async function authHeaders() {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export async function enablePushReminders() {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("Couldn't save your subscription — please try again.");
  return true;
}

export async function disablePushReminders() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    /* best effort — the local unsubscribe already happened */
  }
}
