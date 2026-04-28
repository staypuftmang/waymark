import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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
 * URL — Safari renders PDFs and PNGs inline, where the user can use the
 * native share sheet (square + arrow) to save to Photos / Files / etc.
 * The journal is one back-tap away.
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

    // Photo cover only: explicit 3:2 hero box. Some mobile browsers don't
    // resolve `aspect-ratio` cleanly inside html2canvas's layout pass,
    // which is what produces the stretched hero image we saw on iOS.
    // Must match the aspectRatio set on the cover hero in JournalPreview /
    // PublicJournalView (3 / 2) so capture matches the live render.
    if (cover.querySelector("img")) {
      const hero = cover.querySelector(":scope > div") as HTMLElement | null;
      if (hero) {
        const HERO_W = 960;
        const HERO_H = Math.round((HERO_W * 2) / 3);
        hero.style.width = `${HERO_W}px`;
        hero.style.height = `${HERO_H}px`;
        hero.style.aspectRatio = "auto";
      }
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
  // Carry over computed background so the clone matches the source visually
  // even before html2canvas reads it.
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
  // Preserve sticky/relative children — they should resolve against the clone.
  clone.style.contain = "layout";

  document.body.appendChild(clone);
  prepareCloneForCapture(clone);

  // Allow layout/paint to settle before html2canvas reads sizes.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  try {
    return await fn(clone);
  } finally {
    clone.remove();
  }
}

/**
 * Walk from each <img> up to its "entry wrapper": the ancestor that represents
 * one logical journal unit (photo + caption + notes + paragraph). Stops at the
 * first ancestor that has siblings — those siblings are the neighboring entries.
 * Magazine pairs are collapsed to their group wrapper so both columns render
 * together as a single unit.
 */
function findEntryElements(root: HTMLElement): HTMLElement[] {
  const entries: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  root.querySelectorAll("img").forEach((img) => {
    if (img.closest("[data-export-cover]")) return;

    let entry: HTMLElement | null = img.parentElement;
    while (entry && entry !== root) {
      const parent = entry.parentElement;
      if (!parent || parent === root) break;

      if (parent.classList.contains("wm-magazine-pair")) {
        entry = parent.parentElement;
        continue;
      }

      if (parent.children.length > 1) break;
      entry = parent;
    }

    if (entry && entry !== root && !seen.has(entry)) {
      seen.add(entry);
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}

async function captureUnit(
  el: HTMLElement,
  bgColor: string,
  contentWidth: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = await html2canvas(el, {
    scale: captureScale(),
    useCORS: true,
    backgroundColor: bgColor,
    logging: false,
    windowWidth: CAPTURE_WIDTH,
  });
  const ratio = contentWidth / canvas.width;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: contentWidth,
    height: canvas.height * ratio,
  };
}

export async function exportPDF(
  elementId: string,
  title: string,
  bgColor: string,
  _captionFont: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  await withOffscreenClone(element, async (clone) => {
    const cover = clone.querySelector("[data-export-cover]") as HTMLElement | null;
    const footer = clone.querySelector("[data-export-footer]") as HTMLElement | null;
    const entries = findEntryElements(clone);

    // A4 in points
    const pdfWidth = 595.28;
    const pdfHeight = 841.89;
    const margin = 28;
    // Hard safety margin at the bottom of every page — nothing may be placed
    // below this line. Larger than the top/side margin because text baselines
    // and html2canvas descenders can bleed past the computed bounding box,
    // and because some PDF viewers (and physical printers) crop a few extra
    // pts at the page edge.
    const bottomSafety = 60;
    const usableBottom = pdfHeight - bottomSafety;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = usableBottom - margin;
    const entryGap = 20;

    const pdf = new jsPDF("p", "pt", "a4");
    let firstPagePrimed = false;
    let yCursor = margin;

    const fillBg = () => {
      pdf.setFillColor(bgColor);
      pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
    };

    const primeNewPage = () => {
      if (firstPagePrimed) pdf.addPage();
      firstPagePrimed = true;
      fillBg();
      yCursor = margin;
    };

    const place = (
      unit: { dataUrl: string; width: number; height: number },
      opts: { forceNewPage?: boolean } = {},
    ) => {
      let w = unit.width;
      let h = unit.height;
      if (h > contentHeight) {
        const s = contentHeight / h;
        h = contentHeight;
        w *= s;
      }

      const spaceLeft = usableBottom - yCursor;
      if (opts.forceNewPage || h > spaceLeft) primeNewPage();

      const x = margin + (contentWidth - w) / 2;
      pdf.addImage(unit.dataUrl, "PNG", x, yCursor, w, h);
      yCursor += h + entryGap;
    };

    // Cover (title page): vertically centered on page 1.
    primeNewPage();
    if (cover) {
      const coverUnit = await captureUnit(cover, bgColor, contentWidth);
      let cw = coverUnit.width;
      let ch = coverUnit.height;
      if (ch > contentHeight) {
        const s = contentHeight / ch;
        ch = contentHeight;
        cw *= s;
      }
      const cx = margin + (contentWidth - cw) / 2;
      const cy = margin + (contentHeight - ch) / 2;
      pdf.addImage(coverUnit.dataUrl, "PNG", cx, cy, cw, ch);
      yCursor = pdfHeight;
    }

    for (const entry of entries) {
      const unit = await captureUnit(entry, bgColor, contentWidth);
      place(unit);
    }

    if (footer) {
      const footerUnit = await captureUnit(footer, bgColor, contentWidth);
      let fw = footerUnit.width;
      let fh = footerUnit.height;
      if (fh > contentHeight) {
        const s = contentHeight / fh;
        fh = contentHeight;
        fw *= s;
      }

      const fitsOnCurrentPage = yCursor + fh <= usableBottom;
      if (!fitsOnCurrentPage) primeNewPage();

      const fx = margin + (contentWidth - fw) / 2;
      const fy = fitsOnCurrentPage ? yCursor : usableBottom - fh;
      pdf.addImage(footerUnit.dataUrl, "PNG", fx, fy, fw, fh);
    }

    const blob = pdf.output("blob");
    await deliverFile(blob, `Waymark - ${sanitizeFilename(title)}.pdf`, "application/pdf");
  });
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
