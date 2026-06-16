// Render the calendar print layout into a multi-page Letter PDF.
//
// We capture each .calendar-page-export node individually so the output
// matches the 8.5 x 11 page geometry the PrintLayout component renders,
// rather than chopping a single tall preview into letter-shaped slices.
// html2canvas-pro and jsPDF are lazily imported so they only enter the
// bundle when the user actually exports.

export async function exportPreviewToPdf(
  rootElementId: string,
  fileName: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const root = document.getElementById(rootElementId);
  if (!root) throw new Error(`Element #${rootElementId} not found.`);

  const pages = Array.from(
    root.querySelectorAll<HTMLElement>(".calendar-page-export"),
  );
  const targets = pages.length > 0 ? pages : [root];

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Letter @ 72pt — 612 x 792.
  const pdfWidth = 612;
  const pdfHeight = 792;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  for (let i = 0; i < targets.length; i++) {
    const el = targets[i];
    const canvas = await html2canvas(el, {
      // Pages render on-screen at 96 DPI (816 x 1056 CSS px). Upscale the
      // capture to ~300 DPI (2550 x 3300) so the PDF stays print-sharp.
      scale: 300 / 96,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: el.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");

    // Fit the captured page to the Letter sheet preserving aspect.
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pdfWidth / pdfHeight;
    let drawW = pdfWidth;
    let drawH = pdfHeight;
    if (imgRatio > pageRatio) {
      drawW = pdfWidth;
      drawH = pdfWidth / imgRatio;
    } else {
      drawH = pdfHeight;
      drawW = pdfHeight * imgRatio;
    }
    const offsetX = (pdfWidth - drawW) / 2;
    const offsetY = (pdfHeight - drawH) / 2;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", offsetX, offsetY, drawW, drawH);
  }

  pdf.save(fileName);
}
