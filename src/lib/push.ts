import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string,
  appId: appId as string,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushStatus = "registered" | "not-configured" | "unsupported" | "open-in-new-tab" | "denied";

/** Registers this device for push. Pass ask=true only from a user tap. */
export async function enablePush(userId: string, ask = false): Promise<PushStatus> {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey || !firebaseConfig.messagingSenderId) return "not-configured";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  let perm = Notification.permission;
  if (perm !== "granted") {
    if (!ask || perm === "denied") return "denied";
    perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
  }
  const query = new URLSearchParams(firebaseConfig).toString();
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, { scope: "/firebase-cloud-messaging-push-scope" });
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
  if (!token) return "denied";
  await supabase.from("push_tokens").upsert({ token, user_id: userId, updated_at: new Date().toISOString() });
  return "registered";
}

/** Fire-and-forget: notify recipients of something I just created. */
export function sendPush(kind: "dm" | "group" | "call", id: string) {
  supabase.functions.invoke("send-push", { body: { kind, id } }).catch(() => {});
}
