import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().substring(0, 100);
}

interface ExportOptions {
  elementId: string;
  bgColor: string;
}

async function captureElement(opts: ExportOptions): Promise<HTMLCanvasElement> {
  const element = document.getElementById(opts.elementId);
  if (!element) throw new Error("Element not found");

  // Hide UI chrome
  const topBar = element.querySelector("[data-export-hide='top']") as HTMLElement | null;
  const refineBtn = element.querySelector("[data-export-hide='refine']") as HTMLElement | null;
  const origTopDisplay = topBar?.style.display;
  const origRefineDisplay = refineBtn?.style.display;
  if (topBar) topBar.style.display = "none";
  if (refineBtn) refineBtn.style.display = "none";

  // Handle filmstrip: expand overflow
  const filmstripContainer = element.querySelector("[data-layout='filmstrip']") as HTMLElement | null;
  const origOverflow = filmstripContainer?.style.overflowX;
  const origFlex = filmstripContainer?.style.flexWrap;
  if (filmstripContainer) {
    filmstripContainer.style.overflowX = "visible";
    filmstripContainer.style.flexWrap = "wrap";
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: opts.bgColor,
    height: element.scrollHeight,
    windowHeight: element.scrollHeight,
    logging: false,
  });

  // Restore UI chrome
  if (topBar) topBar.style.display = origTopDisplay || "";
  if (refineBtn) refineBtn.style.display = origRefineDisplay || "";
  if (filmstripContainer) {
    filmstripContainer.style.overflowX = origOverflow || "";
    filmstripContainer.style.flexWrap = origFlex || "";
  }

  return canvas;
}

export async function exportPDF(elementId: string, title: string, bgColor: string, captionFont: string): Promise<void> {
  const canvas = await captureElement({ elementId, bgColor });

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 dimensions in points (72 dpi)
  const pdfWidth = 595.28;
  const pdfHeight = 841.89;
  const margin = 20;
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = pdfHeight - margin * 2;

  // Scale factor: map canvas pixels to PDF points
  const scale = contentWidth / imgWidth;
  const scaledFullHeight = imgHeight * scale;

  const pdf = new jsPDF("p", "pt", "a4");
  let yOffset = 0;
  let pageNum = 0;

  while (yOffset < scaledFullHeight) {
    if (pageNum > 0) pdf.addPage();

    // Calculate source slice from canvas
    const sourceY = yOffset / scale;
    const sourceH = Math.min(contentHeight / scale, imgHeight - sourceY);
    const destH = sourceH * scale;

    // Create a slice canvas
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = imgWidth;
    sliceCanvas.height = Math.ceil(sourceH);
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceH, 0, 0, imgWidth, sourceH);
    }

    const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.85);
    pdf.addImage(sliceDataUrl, "JPEG", margin, margin, contentWidth, destH);

    yOffset += contentHeight;
    pageNum++;
  }

  // Add footer on last page
  const lastPageHeight = pdfHeight;
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Made with Waymark", pdfWidth / 2, lastPageHeight - 20, { align: "center" });

  const filename = `Waymark - ${sanitizeFilename(title)}.pdf`;
  pdf.save(filename);
}

export async function exportImage(elementId: string, title: string, bgColor: string): Promise<void> {
  const canvas = await captureElement({ elementId, bgColor });

  // Convert to JPEG blob and download
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
