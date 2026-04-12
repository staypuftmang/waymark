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

      const parentDisplay = getComputedStyle(parent).display;
      const parentChildren = parent.children.length;
      if (
        parent === element ||
        ((parentDisplay === "grid" || parentDisplay === "flex") && parentChildren > 1)
      ) {
        break;
      }
      entry = parent;
    }

    if (entry && entry !== element && !seen.has(entry)) {
      seen.add(entry);
      const rect = entry.getBoundingClientRect();
      entries.push({
        top: Math.round(rect.top - elementRect.top),
        bottom: Math.round(rect.bottom - elementRect.top),
      });
    }
  });

  return entries.sort((a, b) => a.top - b.top);
}

export async function exportPDF(elementId: string, title: string, bgColor: string, captionFont: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const restore = prepareForCapture(element);

  // Collect entry bounds from DOM BEFORE capture
  const entryBounds = findEntryBounds(element);

  const canvas = await html2canvas(element, {
    scale: 2,
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

  // Canvas is at 2x scale, so DOM positions * 2 = canvas positions
  const canvasEntries = entryBounds.map((e) => ({
    top: e.top * 2,
    bottom: e.bottom * 2,
  }));

  // How many canvas pixels fit in one PDF page
  const pdfScale = contentWidth / canvas.width;
  const maxCanvasPerPage = contentHeight / pdfScale;

  // Build page slices — fill each page as full as possible.
  // Only break when the NEXT entry's bottom would exceed the page.
  const pages: { start: number; end: number }[] = [];
  let cursor = 0;

  while (cursor < canvas.height) {
    const pageLimit = cursor + maxCanvasPerPage;

    if (pageLimit >= canvas.height) {
      // Everything remaining fits on this page
      pages.push({ start: cursor, end: canvas.height });
      break;
    }

    // Find the last entry whose BOTTOM fits within this page.
    // The entry just needs to end before the page limit — it doesn't matter
    // where it starts, since earlier content (cover, brief, previous entries)
    // is already on this page.
    let breakAt = -1;
    for (let i = canvasEntries.length - 1; i >= 0; i--) {
      const entry = canvasEntries[i];
      if (entry.bottom > cursor && entry.bottom <= pageLimit) {
        breakAt = entry.bottom;
        break;
      }
    }

    if (breakAt > cursor) {
      // Break after the last entry that fully fits
      pages.push({ start: cursor, end: breakAt });
      cursor = breakAt;
    } else {
      // No entry fits entirely — find the first entry that STARTS after cursor
      // and break before it (push it to the next page).
      const nextEntry = canvasEntries.find((e) => e.top > cursor);
      if (nextEntry && nextEntry.top > cursor) {
        pages.push({ start: cursor, end: nextEntry.top });
        cursor = nextEntry.top;
      } else {
        // Absolute fallback — single entry taller than a full page
        pages.push({ start: cursor, end: pageLimit });
        cursor = pageLimit;
      }
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
    const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.85);
    pdf.addImage(sliceDataUrl, "JPEG", margin, margin, contentWidth, destH);

    // Footer on last page — 40-60px gap below content (50pt in PDF space)
    if (i === pages.length - 1) {
      const footerY = Math.min(margin + destH + 50, pdfHeight - 30);
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Made with Waymark \u00B7 mywaymarks.com", pdfWidth / 2, footerY, { align: "center" });
    }
  }

  const filename = `Waymark - ${sanitizeFilename(title)}.pdf`;
  pdf.save(filename);
}

export async function exportImage(elementId: string, title: string, bgColor: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const restore = prepareForCapture(element);

  const canvas = await html2canvas(element, {
    scale: 2,
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
    0.85
  );
}
