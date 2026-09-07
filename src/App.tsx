import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULTS,
  type Inputs,
  type Opening,
  OPENING_PRESETS,
  SURFACE_COVERAGE,
  calculate,
  fmt1,
  fmt2,
  money,
} from './paint';

function encode(i: Inputs): string {
  const p = new URLSearchParams();
  p.set('m', i.mode);
  p.set('l', String(i.length));
  p.set('w', String(i.width));
  p.set('h', String(i.height));
  p.set('wa', String(i.wallArea));
  p.set('c', i.includeCeiling ? '1' : '0');
  p.set('co', String(i.coats));
  p.set('cov', String(i.coveragePerLitre));
  p.set('ts', String(i.tinSize));
  p.set('pp', String(i.pricePerTin));
  p.set('wp', String(i.wastagePct));
  p.set('op', i.openings.map((o) => `${o.kind[0]}:${o.width}:${o.height}:${o.count}`).join(','));
  return p.toString();
}

function decode(): Inputs {
  const out: Inputs = { ...DEFAULTS, openings: DEFAULTS.openings.map((o) => ({ ...o })) };
  try {
    const p = new URLSearchParams(window.location.search);
    const num = (k: string, d: number) => {
      const v = p.get(k);
      return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d;
    };
    if (p.get('m') === 'area' || p.get('m') === 'room') out.mode = p.get('m') as Inputs['mode'];
    out.length = num('l', out.length);
    out.width = num('w', out.width);
    out.height = num('h', out.height);
    out.wallArea = num('wa', out.wallArea);
    out.includeCeiling = p.get('c') === '1';
    out.coats = num('co', out.coats);
    out.coveragePerLitre = num('cov', out.coveragePerLitre);
    out.tinSize = num('ts', out.tinSize);
    out.pricePerTin = num('pp', out.pricePerTin);
    out.wastagePct = num('wp', out.wastagePct);
    const op = p.get('op');
    if (op != null) {
      out.openings = op
        ? op.split(',').map((s) => {
            const [k, w, h, c] = s.split(':');
            const kind = k === 'd' ? 'door' : k === 'w' ? 'window' : 'custom';
            return { kind, width: Number(w) || 0, height: Number(h) || 0, count: Number(c) || 1 } as Opening;
          })
        : [];
    }
  } catch {
    /* ignore */
  }
  return out;
}

function Num({
  label, suffix, value, onChange, step, min,
}: {
  label: string; suffix?: string; value: number; onChange: (n: number) => void; step?: number; min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="ibox">
        <input
          type="number"
          inputMode="decimal"
          step={step ?? 0.1}
          min={min ?? 0}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {suffix && <i>{suffix}</i>}
      </div>
    </label>
  );
}

export default function App() {
  const [inp, setInp] = useState<Inputs>(decode);
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<Inputs>) => setInp((p) => ({ ...p, ...patch }));

  useEffect(() => {
    try {
      window.history.replaceState(null, '', `?${encode(inp)}`);
    } catch {
      /* ignore */
    }
  }, [inp]);

  const r = useMemo(() => calculate(inp), [inp]);

  const setOpening = (idx: number, patch: Partial<Opening>) =>
    setInp((p) => ({ ...p, openings: p.openings.map((o, k) => (k === idx ? { ...o, ...patch } : o)) }));
  const addOpening = (kind: 'door' | 'window' | 'custom') => {
    const preset = kind === 'custom' ? { width: 1, height: 1 } : OPENING_PRESETS[kind];
    setInp((p) => ({ ...p, openings: [...p.openings, { kind, width: preset.width, height: preset.height, count: 1 }] }));
  };
  const removeOpening = (idx: number) =>
    setInp((p) => ({ ...p, openings: p.openings.filter((_, k) => k !== idx) }));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Paint Calculator</h1>
        <p className="tag">
          Work out how many litres and tins of paint you need for a room or a wall — after taking off
          doors and windows and allowing for a second coat. Metric, and it runs in your browser.
        </p>
      </header>

      <div className="cols">
        <form className="panel form" onSubmit={(e) => e.preventDefault()}>
          <div className="seg">
            <button className={inp.mode === 'room' ? 'on' : ''} onClick={() => set({ mode: 'room' })} type="button">
              By room size
            </button>
            <button className={inp.mode === 'area' ? 'on' : ''} onClick={() => set({ mode: 'area' })} type="button">
              By wall area
            </button>
          </div>

          {inp.mode === 'room' ? (
            <>
              <div className="two">
                <Num label="Room length" suffix="m" value={inp.length} onChange={(n) => set({ length: n })} />
                <Num label="Room width" suffix="m" value={inp.width} onChange={(n) => set({ width: n })} />
              </div>
              <Num label="Wall height" suffix="m" value={inp.height} onChange={(n) => set({ height: n })} />
              <label className="check">
                <input type="checkbox" checked={inp.includeCeiling} onChange={(e) => set({ includeCeiling: e.target.checked })} />
                <span>Also paint the ceiling ({fmt1(inp.length * inp.width)} m²)</span>
              </label>
            </>
          ) : (
            <Num label="Total wall area to paint" suffix="m²" value={inp.wallArea} onChange={(n) => set({ wallArea: n })} step={1} />
          )}

          {inp.mode === 'room' && (
            <>
              <h2>Doors &amp; windows to subtract</h2>
              {inp.openings.map((o, idx) => (
                <div className="opening" key={idx}>
                  <select value={o.kind} onChange={(e) => setOpening(idx, { kind: e.target.value as Opening['kind'] })}>
                    <option value="door">Door</option>
                    <option value="window">Window</option>
                    <option value="custom">Other</option>
                  </select>
                  <input type="number" step={0.05} value={o.width} onChange={(e) => setOpening(idx, { width: Number(e.target.value) })} aria-label="width" />
                  <span className="x">×</span>
                  <input type="number" step={0.05} value={o.height} onChange={(e) => setOpening(idx, { height: Number(e.target.value) })} aria-label="height" />
                  <input type="number" step={1} min={1} value={o.count} onChange={(e) => setOpening(idx, { count: Number(e.target.value) })} aria-label="count" className="cnt" />
                  <button type="button" className="rm" onClick={() => removeOpening(idx)} aria-label="Remove">×</button>
                </div>
              ))}
              <div className="addrow">
                <button type="button" onClick={() => addOpening('door')}>+ Door</button>
                <button type="button" onClick={() => addOpening('window')}>+ Window</button>
                <button type="button" onClick={() => addOpening('custom')}>+ Other</button>
              </div>
            </>
          )}

          <h2>Paint &amp; coats</h2>
          <div className="two">
            <Num label="Number of coats" value={inp.coats} onChange={(n) => set({ coats: n })} step={1} min={1} />
            <Num label="Wastage allowance" suffix="%" value={inp.wastagePct} onChange={(n) => set({ wastagePct: n })} step={1} />
          </div>
          <label className="field">
            <span>Coverage (m² per litre, one coat)</span>
            <div className="ibox">
              <input type="number" step={0.5} value={inp.coveragePerLitre} onChange={(e) => set({ coveragePerLitre: Number(e.target.value) })} />
              <i>m²/L</i>
            </div>
          </label>
          <select
            className="covpreset"
            value=""
            onChange={(e) => e.target.value && set({ coveragePerLitre: Number(e.target.value) })}
          >
            <option value="">Pick a surface…</option>
            {SURFACE_COVERAGE.map((s) => (
              <option key={s.label} value={s.value}>
                {s.label} — {s.value} m²/L {s.note ? `(${s.note})` : ''}
              </option>
            ))}
          </select>
          <div className="two">
            <Num label="Tin size" suffix="L" value={inp.tinSize} onChange={(n) => set({ tinSize: n })} step={1} />
            <Num label="Price per tin" suffix="$" value={inp.pricePerTin} onChange={(n) => set({ pricePerTin: n })} step={5} />
          </div>
          <p className="note">Leave price at 0 to hide the cost. Nothing is uploaded.</p>
        </form>

        <div className="panel result">
          <div className="headline">
            <span>You need about</span>
            <strong>{fmt1(r.litresNeeded)} L</strong>
            <span>
              {r.tins} × {fmt1(inp.tinSize)} L tin{r.tins === 1 ? '' : 's'}
              {r.cost != null ? ` · ${money(r.cost)}` : ''}
            </span>
          </div>

          <table className="bd">
            <tbody>
              {inp.mode === 'room' && (
                <tr><th>Wall area (perimeter × height)</th><td>{fmt1(r.grossWallArea)} m²</td></tr>
              )}
              {inp.mode === 'area' && <tr><th>Wall area entered</th><td>{fmt1(r.grossWallArea)} m²</td></tr>}
              {r.ceilingArea > 0 && <tr><th>Ceiling</th><td>+ {fmt1(r.ceilingArea)} m²</td></tr>}
              {r.openingsArea > 0 && <tr className="minus"><th>Doors &amp; windows</th><td>− {fmt2(r.openingsArea)} m²</td></tr>}
              <tr className="sub"><th>Area to paint</th><td>{fmt1(r.paintableArea)} m²</td></tr>
              <tr><th>× {inp.coats} coat{inp.coats === 1 ? '' : 's'}</th><td>{fmt1(r.areaWithCoats)} m²</td></tr>
              <tr><th>÷ {fmt1(inp.coveragePerLitre)} m²/L, + {fmt1(inp.wastagePct)}% wastage</th><td>{fmt2(r.litresNeeded)} L</td></tr>
              <tr className="sub"><th>Buy</th><td>{r.tins} tin{r.tins === 1 ? '' : 's'} = {fmt1(r.litresPurchased)} L</td></tr>
              <tr><th>Left over</th><td>{fmt1(Math.max(0, r.leftoverLitres))} L</td></tr>
            </tbody>
          </table>

          <button className="share" onClick={share}>{copied ? 'Link copied' : 'Copy shareable link'}</button>
        </div>
      </div>

      <p className="disclaimer">
        An estimate. Actual coverage depends on the paint, the colour change, how it is applied, and
        the surface. Buy a little extra rather than run out mid-wall and get a visible join, and keep
        the batch number in case you need more.
      </p>

      <section className="explainer">
        <h2>How the estimate works</h2>
        <p>
          The calculator finds the area of your walls, adds the ceiling if you are painting it,
          subtracts the doors and windows, multiplies by the number of coats, then divides by how
          many square metres a litre covers. A wastage percentage is added for what stays in the tray
          and roller and for touch-ups, and the result is rounded up to whole tins.
        </p>
        <h3>How much does a litre of paint cover?</h3>
        <p>
          A common figure for interior wall and ceiling paint on a smooth, previously painted surface
          is around 13–16&nbsp;m² per litre per coat. New or unsealed plaster, render, and textured or
          porous surfaces drink more — as low as 6&nbsp;m² per litre for bare brick. The tin will state
          a spreading rate; use that if you have it.
        </p>
        <h3>How many coats?</h3>
        <p>
          Two coats is standard for a durable, even finish. Painting a similar colour over a sound
          existing coat can sometimes be done in one; a big colour change, or going light over dark,
          may need a primer or an extra coat. Ceilings are usually two coats of ceiling paint.
        </p>
        <h3>Do I subtract doors and windows?</h3>
        <p>
          Yes, for a tighter estimate — a standard door is about 1.7&nbsp;m² and an average window
          around 1.4&nbsp;m². If you would rather keep a buffer, leave them out and treat the extra
          paint as your safety margin.
        </p>
        <h3>Is anything sent to a server?</h3>
        <p>
          No. The calculation runs in your browser and your inputs are only stored in the page link,
          which the copy button gives you to save or share.
        </p>
        <footer>Paint Calculator · metric · estimate only · runs in your browser · no sign-up</footer>
      </section>
    </div>
  );
}
