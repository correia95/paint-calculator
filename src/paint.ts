// Paint quantity estimator. All areas in m², volumes in litres. Pure functions.

export interface Opening {
  kind: 'door' | 'window' | 'custom';
  width: number; // m
  height: number; // m
  count: number;
}

export const OPENING_PRESETS: Record<'door' | 'window', { width: number; height: number; label: string }> = {
  door: { width: 0.82, height: 2.04, label: 'Standard door' },
  window: { width: 1.2, height: 1.2, label: 'Window' },
};

export interface Inputs {
  // room by perimeter + height, OR direct wall area
  mode: 'room' | 'area';
  length: number; // m (room mode)
  width: number; // m (room mode)
  height: number; // m (wall height)
  wallArea: number; // m (area mode, total)
  includeCeiling: boolean;
  openings: Opening[];
  coats: number;
  coveragePerLitre: number; // m² per litre per coat
  tinSize: number; // litres
  pricePerTin: number; // $ (0 = hide cost)
  wastagePct: number;
}

export const DEFAULTS: Inputs = {
  mode: 'room',
  length: 4,
  width: 3.5,
  height: 2.4,
  wallArea: 40,
  includeCeiling: false,
  openings: [
    { kind: 'door', width: 0.82, height: 2.04, count: 1 },
    { kind: 'window', width: 1.2, height: 1.2, count: 1 },
  ],
  coats: 2,
  coveragePerLitre: 13,
  tinSize: 4,
  pricePerTin: 0,
  wastagePct: 5,
};

export interface Result {
  grossWallArea: number;
  ceilingArea: number;
  openingsArea: number;
  paintableArea: number; // after openings, before coats
  areaWithCoats: number;
  litresNeeded: number; // incl. wastage
  tins: number;
  litresPurchased: number;
  leftoverLitres: number;
  cost: number | null;
  perimeter: number;
}

export function calculate(i: Inputs): Result {
  const perimeter = i.mode === 'room' ? 2 * (i.length + i.width) : 0;
  const grossWall = i.mode === 'room' ? perimeter * i.height : Math.max(0, i.wallArea);
  const ceiling = i.includeCeiling && i.mode === 'room' ? i.length * i.width : 0;

  const openingsArea =
    i.mode === 'room'
      ? i.openings.reduce(
          (sum, o) => sum + Math.max(0, o.width) * Math.max(0, o.height) * Math.max(0, o.count),
          0,
        )
      : 0;

  const paintable = Math.max(0, grossWall - openingsArea) + ceiling;
  const withCoats = paintable * Math.max(1, i.coats);
  const cov = i.coveragePerLitre > 0 ? i.coveragePerLitre : 13;
  const baseLitres = withCoats / cov;
  const litresNeeded = baseLitres * (1 + Math.max(0, i.wastagePct) / 100);

  const tinSize = i.tinSize > 0 ? i.tinSize : 4;
  const tins = Math.max(paintable > 0 ? 1 : 0, Math.ceil(litresNeeded / tinSize - 1e-9));
  const litresPurchased = tins * tinSize;
  const cost = i.pricePerTin > 0 ? tins * i.pricePerTin : null;

  return {
    grossWallArea: grossWall,
    ceilingArea: ceiling,
    openingsArea,
    paintableArea: paintable,
    areaWithCoats: withCoats,
    litresNeeded,
    tins,
    litresPurchased,
    leftoverLitres: litresPurchased - litresNeeded,
    cost,
    perimeter,
  };
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString(undefined);
export const fmt2 = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

// The optional cost estimate is shown in the viewer's local currency.
const REGION_CCY: Record<string, string> = {
  AU: 'AUD', US: 'USD', GB: 'GBP', CA: 'CAD', NZ: 'NZD', IN: 'INR', SG: 'SGD',
  ZA: 'ZAR', JP: 'JPY', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR',
};
function localCurrency(): string {
  try {
    const langs =
      typeof navigator !== 'undefined' && navigator.languages?.length
        ? navigator.languages
        : ['en-AU'];
    for (const l of langs) {
      let region: string | undefined;
      try {
        region = new Intl.Locale(l).maximize().region;
      } catch {
        region = (l.split('-')[1] || '').toUpperCase() || undefined;
      }
      if (region && REGION_CCY[region]) return REGION_CCY[region];
    }
  } catch {
    /* ignore */
  }
  return 'AUD';
}
const CCY = localCurrency();
export const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: CCY, maximumFractionDigits: 0 });

// Rough surface-specific coverage guidance (m² per litre, one coat).
export const SURFACE_COVERAGE: { label: string; value: number; note: string }[] = [
  { label: 'Smooth plasterboard, previously painted', value: 16, note: 'best case' },
  { label: 'Interior walls & ceilings (typical)', value: 13, note: 'common default' },
  { label: 'New / unsealed plaster', value: 10, note: 'soaks up more' },
  { label: 'Render or lightly textured', value: 9, note: '' },
  { label: 'Brick, heavy texture', value: 6, note: 'very absorbent' },
];
