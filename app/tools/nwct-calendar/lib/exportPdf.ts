// Render the calendar preview DOM into a single PDF using
// html2canvas-pro + jsPDF. Both are loaded lazily so they only enter
// the bundle when the user actually exports.

export async function exportPreviewToPdf(elementId: string, fileName: string): Promise<void> {
  if (typeof window === "undefined") return;
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found.`);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: el.scrollWidth,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Letter @ 72pt — 612 x 792.
  const pdfWidth = 612;
  const pdfHeight = 792;
  const margin = 24;
  const contentWidth = pdfWidth - margin * 2;
  const scale = contentWidth / imgWidth;
  const scaledHeight = imgHeight * scale;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageContentHeight = pdfHeight - margin * 2;
  const totalPages = Math.max(1, Math.ceil(scaledHeight / pageContentHeight));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();
    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin - page * pageContentHeight,
      imgWidth * scale,
      scaledHeight,
    );
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pdfWidth, margin, "F");
    pdf.rect(0, pdfHeight - margin, pdfWidth, margin, "F");
  }

  pdf.save(fileName);
}
