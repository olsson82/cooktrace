/**
 * notifications.js — Local + push notifications for CookTrace.
 *
 * Phase A stub: real reminder scheduling (cook-day reminders, thaw alerts,
 * shopping-day pings) lands when the corresponding features ship.
 */

export async function requestPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch { return false; }
}

export async function notify(_title, _body, _opts = {}) {
  // No-op for Phase A.
  return;
}
