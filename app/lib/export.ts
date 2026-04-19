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

  const topBar = element.querySelector("[data-export-hide='top']") as HTMLElement | null;
  if (topBar) {
    const orig = topBar.style.display;
    topBar.style.display = "none";
    originals.push(() => { topBar.style.display = orig; });
  }

  const refineBtn = element.querySelector("[data-export-hide='refine']") as HTMLElement | null;
  if (refineBtn) {
    const orig = refineBtn.style.display;
    refineBtn.style.display = "none";
    originals.push(() => { refineBtn.style.display = orig; });
  }

  // Cover: shrink the outer wrapper to match the hero image's max-width, and
  // drop horizontal padding. Otherwise the wrapper captures at viewport width
  // (e.g. 1280px on desktop) with the image only 960px inside it, and the
  // whole thing gets scaled down to fit PDF content width — making the hero
  // image look small with empty side gutters.
  const cover = element.querySelector("[data-export-cover]") as HTMLElement | null;
  if (cover) {
    const origMH = cover.style.minHeight;
    const origP = cover.style.padding;
    const origW = cover.style.width;
    const origMW = cover.style.maxWidth;
    const origM = cover.style.margin;
    cover.style.minHeight = "auto";
    cover.style.padding = "0 0 28px";
    cover.style.width = "960px";
    cover.style.maxWidth = "960px";
    cover.style.margin = "0 auto";
    originals.push(() => {
      cover.style.minHeight = origMH;
      cover.style.padding = origP;
      cover.style.width = origW;
      cover.style.maxWidth = origMW;
      cover.style.margin = origM;
    });
  }

  // Expand filmstrip so every photo captures — not just the visible slice.
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
 * Walk from each <img> up to its "entry wrapper": the ancestor that represents
 * one logical journal unit (photo + caption + notes + paragraph). Stops at the
 * first ancestor that has siblings — those siblings are the neighboring entries.
 * Magazine pairs are collapsed to their group wrapper so both columns render
 * together as a single unit.
 */
function findEntryElements(element: HTMLElement): HTMLElement[] {
  const entries: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  element.querySelectorAll("img").forEach((img) => {
    // Skip images inside the cover — they're captured as part of the cover unit
    if (img.closest("[data-export-cover]")) return;

    let entry: HTMLElement | null = img.parentElement;
    while (entry && entry !== element) {
      const parent = entry.parentElement;
      if (!parent || parent === element) break;

      if (parent.classList.contains("wm-magazine-pair")) {
        entry = parent.parentElement;
        continue;
      }

      if (parent.children.length > 1) break;
      entry = parent;
    }

    if (entry && entry !== element && !seen.has(entry)) {
      seen.add(entry);
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}

async function captureUnit(
  el: HTMLElement,
  bgColor: string,
  contentWidth: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = await html2canvas(el, {
    scale: 3,
    useCORS: true,
    backgroundColor: bgColor,
    logging: false,
  });
  const ratio = contentWidth / canvas.width;
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    width: contentWidth,
    height: canvas.height * ratio,
  };
}

export async function exportPDF(
  elementId: string,
  title: string,
  bgColor: string,
  _captionFont: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const restore = prepareForCapture(element);

  try {
    const cover = element.querySelector("[data-export-cover]") as HTMLElement | null;
    const footer = element.querySelector("[data-export-footer]") as HTMLElement | null;
    const entries = findEntryElements(element);

    // A4 in points
    const pdfWidth = 595.28;
    const pdfHeight = 841.89;
    const margin = 28;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = pdfHeight - margin * 2;
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

    // Place one captured unit on the current page, starting a new page if it
    // doesn't fit the remaining space. Oversize units are scaled to one page.
    const place = (
      unit: { dataUrl: string; width: number; height: number },
      opts: {
        forceNewPage?: boolean;
        extraBottom?: number;
        lowerThirdOnNewPage?: boolean;
      } = {}
    ) => {
      const bottomReserve = opts.extraBottom ?? 0;
      let w = unit.width;
      let h = unit.height;
      const maxH = contentHeight - bottomReserve;
      if (h > maxH) {
        const s = maxH / h;
        h = maxH;
        w *= s;
      }

      const spaceLeft = pdfHeight - margin - yCursor - bottomReserve;
      const needsNewPage = !!opts.forceNewPage || h > spaceLeft;
      if (needsNewPage) primeNewPage();

      const x = margin + (contentWidth - w) / 2;
      let y = yCursor;
      if (needsNewPage && opts.lowerThirdOnNewPage) {
        // Center vertically in the lower third of the page (middle at 5/6).
        y = pdfHeight * (5 / 6) - h / 2;
        y = Math.min(y, pdfHeight - margin - bottomReserve - h);
        y = Math.max(y, margin);
      }
      pdf.addImage(unit.dataUrl, "JPEG", x, y, w, h);
      yCursor = y + h + entryGap;
    };

    // Cover: full PDF width at the top of page 1. Occupies roughly the top
    // half of the page (hero is 16:9 → ~305pt tall at 539pt wide; trip brief
    // and padding push that closer to 50–60%). No vertical centering — that
    // previously left the hero floating in the middle with blank space.
    primeNewPage();
    if (cover) {
      const coverUnit = await captureUnit(cover, bgColor, contentWidth);
      place(coverUnit);
      // Push the first entry onto a fresh page regardless of remaining space.
      yCursor = pdfHeight;
    }

    for (const entry of entries) {
      const unit = await captureUnit(entry, bgColor, contentWidth);
      place(unit);
    }

    if (footer) {
      // Add a 40pt gap above the footer on top of the normal 20pt entryGap,
      // so there's ~60pt of breathing room between the last entry/divider
      // and "Made with Waymark". Reserve 60pt at the page bottom so the
      // text always sits well within the printable area. If the footer
      // doesn't fit on the current page, it gets its own final page and
      // we center it vertically in the lower third (colophon style).
      const footerUnit = await captureUnit(footer, bgColor, contentWidth);
      yCursor += 40;
      place(footerUnit, { extraBottom: 60, lowerThirdOnNewPage: true });
    }

    pdf.save(`Waymark - ${sanitizeFilename(title)}.pdf`);
  } finally {
    restore();
  }
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
