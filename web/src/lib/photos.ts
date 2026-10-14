/**
 * Bioguide IDs for tracked members, keyed by politician slug. Portraits live in
 * /public/photos/congress, resized from unitedstates.github.io/images/congress/original
 * (their fixed 225x275 versions distort non-4:5 originals).
 */
const BIOGUIDE: Record<string, string> = {
  "nancy-pelosi": "P000197",
  "dan-crenshaw": "C001120",
  "marjorie-taylor-greene": "G000596",
  "josh-gottheimer": "G000583",
  "michael-mccaul": "M001157",
  "ro-khanna": "K000389",
  "nancy-mace": "M000194",
  "austin-scott": "S001189",
  "patrick-mchenry": "M001156",
  "chip-roy": "R000614",
  "brian-mast": "M001199",
  "thomas-massie": "M001184",
};

export function politicianPhoto(slug: string | null | undefined): string | null {
  const id = slug ? BIOGUIDE[slug] : undefined;
  return id ? `/photos/congress/${id}.jpg` : null;
}

/** Fund logos shipped in /public/logos/institutions, keyed by institution slug. */
const INSTITUTION_LOGOS = new Set([
  "altimeter",
  "appaloosa",
  "ark-invest",
  "bridgewater",
  "coatue",
  "elliott",
  "founders-fund",
  "greenlight",
  "paulson",
  "point72",
  "renaissance",
  "saba-capital",
  "soros",
  "third-point",
  "tiger-global",
  "tudor",
  "viking-global",
]);

export function institutionLogo(slug: string | null | undefined): string | null {
  return slug && INSTITUTION_LOGOS.has(slug) ? `/logos/institutions/${slug}.png` : null;
}

export function stockLogo(symbol: string): string {
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol.toUpperCase())}.png`;
}
