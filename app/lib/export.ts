import html2canvas from "html2canvas";

/**
 * Width we lay the journal out at while capturing, regardless of viewport.
 * Lock to a single desktop width so a phone download looks identical to a
 * laptop download — same proportions, same line breaks, same hero crop.
 */
export const CAPTURE_WIDTH = 1200;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().substring(0, 100);
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const touch = navigator.maxTouchPoints > 0;
  const ua = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
  return touch && ua;
}

function captureScale(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  // Mobile Safari blows up canvases past ~16M pixels and silently drops the
  // capture. Cap mobile scale at 2 — still sharp on Retina, well under the
  // memory ceiling. Desktop keeps the higher scale for crisp text exports.
  if (isMobileBrowser()) return 2;
  return Math.max(2, dpr * 2);
}

/**
 * Hand a generated file to the OS.
 *
 * Mobile (iOS Safari especially): post-await calls to navigator.share /
 * window.open lose the user-gesture context and Safari silently blocks
 * them, so the previous "Web Share API + data-URL fallback" path failed
 * with no visible feedback. Instead, navigate the current tab to the blob
 * URL — Safari renders PNGs inline, where the user can use the native
 * share sheet (square + arrow) to save to Photos / Files / etc. The
 * journal is one back-tap away.
 *
 * Desktop: classic blob-URL + anchor-click download for the in-place feel.
 */
async function deliverFile(blob: Blob, filename: string, _mimeType: string): Promise<void> {
  const url = URL.createObjectURL(blob);

  if (isMobileBrowser()) {
    // Don't revoke immediately — Safari needs the URL alive across the
    // navigation. 60s is comfortably past any plausible render time.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    window.location.assign(url);
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Apply the capture-time DOM transformations to a CLONE of the journal
 * (hide chrome, force desktop hero size, expand filmstrip, pad footer).
 * Operates destructively on the clone — never on the live tree — so we
 * don't have to track restore handlers.
 */
function prepareCloneForCapture(clone: HTMLElement): void {
  // Hide chrome (sticky header, refine panel, share button, etc.).
  clone.querySelectorAll<HTMLElement>("[data-export-hide]").forEach((node) => {
    node.style.display = "none";
  });

  // Cover wrapper: shrink to hero width, drop horizontal padding.
  const cover = clone.querySelector("[data-export-cover]") as HTMLElement | null;
  if (cover) {
    cover.style.minHeight = "auto";
    cover.style.padding = "0 0 28px";
    cover.style.width = "960px";
    cover.style.maxWidth = "960px";
    cover.style.margin = "0 auto";

    const heroImg = cover.querySelector("img") as HTMLImageElement | null;
    if (heroImg) {
      heroImg.style.maxHeight = "600px";
      heroImg.style.height = "auto";
      heroImg.style.objectFit = "contain";
    }
  }

  // Filmstrip: wrap rows so every photo lands in the capture.
  const filmstrip = clone.querySelector("[data-layout='filmstrip']") as HTMLElement | null;
  if (filmstrip) {
    filmstrip.style.overflowX = "visible";
    filmstrip.style.flexWrap = "wrap";
  }

  // Footer: padding for descenders so html2canvas doesn't clip the bottom.
  const footer = clone.querySelector("[data-export-footer]") as HTMLElement | null;
  if (footer) {
    footer.style.paddingBottom = "16px";
  }
}

/**
 * Deep-clone the journal DOM into an offscreen wrapper at desktop width,
 * apply prep, hand the clone to `fn`, then remove it. The visible journal
 * is never mutated — fixes layout twitches and stretched-cover bugs on
 * mobile during downloads.
 */
async function withOffscreenClone<T>(
  source: HTMLElement,
  fn: (clone: HTMLElement) => Promise<T>,
): Promise<T> {
  const clone = source.cloneNode(true) as HTMLElement;
  const sourceBg = getComputedStyle(source).backgroundColor;
  clone.style.background = sourceBg;
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.minWidth = `${CAPTURE_WIDTH}px`;
  clone.style.maxWidth = `${CAPTURE_WIDTH}px`;
  clone.style.overflow = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.contain = "layout";

  document.body.appendChild(clone);
  prepareCloneForCapture(clone);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  try {
    return await fn(clone);
  } finally {
    clone.remove();
  }
}

export async function exportImage(elementId: string, title: string, bgColor: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  await withOffscreenClone(element, async (clone) => {
    const canvas = await html2canvas(clone, {
      scale: captureScale(),
      useCORS: true,
      backgroundColor: bgColor,
      width: CAPTURE_WIDTH,
      height: clone.scrollHeight,
      windowWidth: CAPTURE_WIDTH,
      windowHeight: clone.scrollHeight,
      logging: false,
    });

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) return;
    await deliverFile(blob, `Waymark - ${sanitizeFilename(title)}.png`, "image/png");
  });
}
