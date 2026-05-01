/**
 * Tiny pub/sub for the global FeedbackWidget. Lives in its own module so
 * code that only needs to *open* the widget (the /help CTA, future inline
 * triggers) doesn't have to import the heavy widget itself — that would
 * defeat the dynamic-import split.
 */

export const FEEDBACK_OPEN_EVENT = "wm:open-feedback";

export function openFeedback(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_OPEN_EVENT));
}
