// Title and website normalization, ported from the AI Studio source.

export function cleanEventTitle(title: string, venue: string): string {
  if (!title) return "";
  let cleaned = title.trim();

  if (cleaned === cleaned.toUpperCase() && cleaned.length > 4) {
    cleaned = cleaned
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const venueClean = venue ? venue.trim() : "";
  if (venueClean) {
    const escaped = venueClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const venueRegex = new RegExp(`^${escaped}\\s*[:|-]?\\s*`, "i");
    cleaned = cleaned.replace(venueRegex, "");
  }

  const prefixes = [
    "Adult Program -",
    "Adult Program",
    "Children's Program -",
    "Author Talk with",
  ];
  for (const prefix of prefixes) {
    const re = new RegExp(`^${prefix}\\s*`, "i");
    if (re.test(cleaned)) cleaned = cleaned.replace(re, "");
  }

  const dateSuffixRegex = /[:;]?\s*\d{1,2}\/\d{1,2}(\s*(thru|-|to)\s*(\d{1,2}\/\d{1,2})?)?.*$/i;
  cleaned = cleaned.replace(dateSuffixRegex, "");

  cleaned = cleaned.replace(/^"|"$/g, "");
  cleaned = cleaned.replace(/^[\s:-]+/, "").trim();
  cleaned = cleaned.replace(/[:;-]$/, "").trim();
  return cleaned;
}

export function extractDomain(website: string): string {
  if (!website) return "";
  let cleaned = website.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^www\./i, "");
  return cleaned.split(/[/?#]/)[0];
}
