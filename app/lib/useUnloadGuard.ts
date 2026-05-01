import { useEffect } from "react";

/**
 * While `active` is true, intercept browser-level navigation away from the
 * page (close tab, refresh, link click, back/forward) by attaching a
 * `beforeunload` handler. Modern browsers ignore custom strings and show
 * their own generic "Are you sure?" prompt when an event handler calls
 * `preventDefault()` and/or sets `returnValue`.
 *
 * Intentionally does NOT use `visibilitychange` — switching tabs is fine
 * and shouldn't pester the user. Only real navigation triggers the prompt.
 *
 * The handler is removed when `active` flips back to false or on unmount,
 * so it never blocks normal navigation after the work completes or the
 * user cancels.
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
