import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().substring(0, 100);
}

/**
 * Prepare the journal DOM for capture: hide chrome, tighten cover, expand filmstrip.
 * Returns a restore function to undo all changes.
 */
function prepareForCapture(element: HTMLElement) {
  const originals: Array<() => void> = [];

  // Hide top bar
  const topBar = element.querySelector("[data-export-hide='top']") as HTMLElement | null;
  if (topBar) {
    const orig = topBar.style.display;
    topBar.style.display = "none";
    originals.push(() => { topBar.style.display = orig; });
  }

  // Hide refine panel
  const refineBtn = element.querySelector("[data-export-hide='refine']") as HTMLElement | null;
  if (refineBtn) {
    const orig = refineBtn.style.display;
    refineBtn.style.display = "none";
    originals.push(() => { refineBtn.style.display = orig; });
  }

  // Tighten cover section — remove 40vh min-height, reduce padding
  const cover = element.querySelector("[data-export-cover]") as HTMLElement | null;
  if (cover) {
    const origMH = cover.style.minHeight;
    const origP = cover.style.padding;
    cover.style.minHeight = "auto";
    cover.style.padding = "48px 24px 32px";
    originals.push(() => { cover.style.minHeight = origMH; cover.style.padding = origP; });
  }

  // Expand filmstrip overflow
  const filmstrip = element.querySelector("[data-layout='filmstrip']") as HTMLElement | null;
  if (filmstrip) {
    const origOF = filmstrip.style.overflowX;
    const origFW = filmstrip.style.flexWrap;
    filmstrip.style.overflowX = "visible";
    filmstrip.style.flexWrap = "wrap";
    originals.push(() => { filmstrip.style.overflowX = origOF; filmstrip.style.flexWrap = origFW; });
  }

  return () => originals.forEach((fn) => fn());
}

/**
 * Find entry boundaries: for each photo entry, record both its top and bottom
 * (relative to element top). This lets the page-break logic decide whether
 * a full entry fits on the current page.
 */
interface EntryBounds {
  top: number;
  bottom: number;
}

function findEntryBounds(element: HTMLElement): EntryBounds[] {
  const elementRect = element.getBoundingClientRect();
  const entries: EntryBounds[] = [];
  const seen = new Set<HTMLElement>();

  element.querySelectorAll("img").forEach((img) => {
    let entry: HTMLElement | null = img.parentElement;

    while (entry && entry !== element) {
      const parent = entry.parentElement;
      if (!parent || parent === element) break;

      // Special case: Magazine layout pair grid. Both columns of a pair must
      // be treated as ONE entry (the entire group), otherwise asymmetric text
      // heights cause the shorter column to set the break point and truncate
      // the longer column mid-sentence.
      if (parent.classList.contains("wm-magazine-pair")) {
        // Walk up past the pair grid to the group wrapper
        entry = parent.parentElement;
        continue;
      }

      const parentChildren = parent.children.length;
      // Stop when the parent has multiple children — each child is a separate entry.
      // This works for all layouts: block (Classic), grid (Grid), flex (Filmstrip/Stacked).
      if (parent === element || parentChildren > 1) {
        break;
      }
      entry = parent;
    }

    if (entry && entry !== element && !seen.has(entry)) {
      seen.add(entry);
      const rect = entry.getBoundingClientRect();
      // Add bottom margin so we don't clip text at the entry's edge
      const marginBottom = parseFloat(getComputedStyle(entry).marginBottom) || 0;
      entries.push({
        top: Math.round(rect.top - elementRect.top),
        bottom: Math.round(rect.bottom - elementRect.top + marginBottom + 10),
      });
    }
  });

  return entries.sort((a, b) => a.top - b.top);
}

/**
 * Find secondary (soft) break points — tops of block-level text elements.
 * Used as fallback when a photo entry is too tall to fit on one page.
 * Breaking at these points still produces clean breaks (between paragraphs,
 * between caption/notes/body), not mid-sentence.
 */
function findSoftBreaks(element: HTMLElement): number[] {
  const elementRect = element.getBoundingClientRect();
  const breaks = new Set<number>();

  // Scan all block-level text containers inside the element
  const textNodes = element.querySelectorAll("p, div");
  textNodes.forEach((node) => {
    const el = node as HTMLElement;
    if (el === element) return;
    // Skip tiny/decorative elements
    if (el.offsetHeight < 12) return;
    // Skip elements that contain images (these are photo wrappers, not text blocks)
    if (el.querySelector("img")) return;
    // Must contain text directly
    if (!el.textContent || el.textContent.trim().length < 10) return;

    const rect = el.getBoundingClientRect();
    const top = Math.round(rect.top - elementRect.top);
    if (top > 50) breaks.add(top);
  });

  return [...breaks].sort((a, b) => a - b);
}

export async function exportPDF(elementId: string, title: string, bgColor: string, captionFont: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const restore = prepareForCapture(element);

  // Collect entry bounds AND soft break points BEFORE capture
  const entryBounds = findEntryBounds(element);
  const softBreaks = findSoftBreaks(element);

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: bgColor,
    height: element.scrollHeight,
    windowHeight: element.scrollHeight,
    logging: false,
  });

  restore();

  // A4 in points
  const pdfWidth = 595.28;
  const pdfHeight = 841.89;
  const margin = 28;
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = pdfHeight - margin * 2;

  // Canvas is at 3x scale, so DOM positions * 3 = canvas positions
  const captureScale = 3;
  const canvasEntries = entryBounds.map((e) => ({
    top: e.top * captureScale,
    bottom: e.bottom * captureScale,
  }));
  const canvasSoftBreaks = softBreaks.map((y) => y * captureScale);

  // How many canvas pixels fit in one PDF page
  const pdfScale = contentWidth / canvas.width;
  const maxCanvasPerPage = contentHeight / pdfScale;

  // Page-break algorithm:
  //
  // Goal: keep entries (photo + caption + notes + paragraph) intact whenever
  // possible. Only split an entry across pages if it's physically taller than
  // a single page.
  //
  // For each page:
  //   1. Find the largest entry bottom that fits → break there (entry kept whole)
  //   2. If no entry bottom fits, check whether an "oversize entry" (taller than
  //      one page) starts on this page. If so, use a soft break within it.
  //   3. Otherwise: leave the rest of the page blank and start next page at the
  //      next entry top (entries pushed to next page intact).

  const pages: { start: number; end: number }[] = [];
  let cursor = 0;

  // Mark entries that are taller than a single page — these are the only ones
  // allowed to be split across pages
  const oversizeEntries = canvasEntries.filter(
    (e) => e.bottom - e.top > maxCanvasPerPage
  );

  function isInsideOversizeEntry(y: number): boolean {
    return oversizeEntries.some((e) => y > e.top && y < e.bottom);
  }

  while (cursor < canvas.height) {
    const pageLimit = cursor + maxCanvasPerPage;

    if (pageLimit >= canvas.height) {
      pages.push({ start: cursor, end: canvas.height });
      break;
    }

    // Step 1: Find the largest entry BOTTOM that fits
    let bestEntryBottom = -1;
    for (let i = canvasEntries.length - 1; i >= 0; i--) {
      const b = canvasEntries[i].bottom;
      if (b > cursor && b <= pageLimit) {
        bestEntryBottom = b;
        break;
      }
    }

    if (bestEntryBottom > cursor) {
      pages.push({ start: cursor, end: bestEntryBottom });
      cursor = bestEntryBottom;
      continue;
    }

    // Step 2: An oversize entry is ALREADY IN PROGRESS (started on a previous
    // page). We have to keep splitting it. Find the largest soft break inside
    // it that fits on the current page.
    const oversizeContinuingHere = oversizeEntries.find(
      (e) => e.top < cursor && e.bottom > cursor
    );

    if (oversizeContinuingHere) {
      let bestSoft = -1;
      for (let i = canvasSoftBreaks.length - 1; i >= 0; i--) {
        const b = canvasSoftBreaks[i];
        if (b > cursor && b <= pageLimit && isInsideOversizeEntry(b)) {
          bestSoft = b;
          break;
        }
      }

      if (bestSoft > cursor) {
        pages.push({ start: cursor, end: bestSoft });
        cursor = bestSoft;
        continue;
      }

      // No soft break fits — fall back to hard cut to make progress
      pages.push({ start: cursor, end: pageLimit });
      cursor = pageLimit;
      continue;
    }

    // Step 2b: An oversize entry STARTS on this page but cursor isn't at its
    // top yet (we have previous content above). Push the entry to a fresh
    // page where it has the full page to work with — we'll split it there.
    // (Falls through to Step 3 below.)

    // Step 3: No fitting entry, no oversize entry on this page.
    // Skip to the next entry's top (leaving the rest of this page blank).
    const nextEntryTop = canvasEntries
      .map((e) => e.top)
      .filter((t) => t > cursor)
      .sort((a, b) => a - b)[0];

    if (nextEntryTop !== undefined && nextEntryTop > cursor) {
      pages.push({ start: cursor, end: nextEntryTop });
      cursor = nextEntryTop;
    } else {
      // No more entries — render whatever's left
      pages.push({ start: cursor, end: canvas.height });
      cursor = canvas.height;
    }
  }

  // Generate PDF
  const pdf = new jsPDF("p", "pt", "a4");

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();

    const { start, end } = pages[i];
    const sliceH = Math.ceil(end - start);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, sliceCanvas.width, sliceH);
      ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    }

    const destH = sliceH * pdfScale;
    const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(sliceDataUrl, "JPEG", margin, margin, contentWidth, destH);

    // Footer is already in the captured DOM — no need to add a second one via jsPDF
  }

  const filename = `Waymark - ${sanitizeFilename(title)}.pdf`;
  pdf.save(filename);
}

export async function exportImage(elementId: string, title: string, bgColor: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const restore = prepareForCapture(element);

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: bgColor,
    height: element.scrollHeight,
    windowHeight: element.scrollHeight,
    logging: false,
  });

  restore();

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Waymark - ${sanitizeFilename(title)}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    },
    "image/jpeg",
    0.95
  );
}
