/**
 * <LibraryCard /> - the student library card (front + back), pixel-matched to
 * the Figma design, as a reusable React + Tailwind component.
 *
 *   <LibraryCard
 *     student={{ name, id_no, department, session, exp_date, photo }}
 *     logoUrl={bgcLogo}               // optional - a clean emblem is drawn if missing
 *     signatureUrl={signaturePng}     // optional - the line stays blank if missing
 *   />
 *
 * Props
 *   student        { name, id_no, department, session, exp_date, photo }
 *                  (also accepts the Django API names: full_name, student_id,
 *                   valid_thru, photo_url). exp_date may be "2027-12-31",
 *                   a Date, or already formatted ("Dec 2027").
 *   logoUrl        university logo. Default: the BGC Trust University logo, built into
 *                  this file (BGC_LOGO, at the bottom) at the exact size/position of the
 *                  Figma design. Pass your own image URL to replace it.
 *   signatureUrl   chief librarian's signature image (transparent PNG works best)
 *   qrValue        what the QR code on the back encodes (default: student.id_no)
 *   barcodeValue   what the barcode encodes and prints under it (default: student.id_no)
 *   universityName / cardTitle   header text (defaults match the design)
 *   width          FIXED width in px of one card (default 400, so 400 x 252).
 *                  It does not stretch with the window; it only shrinks if the
 *                  screen is narrower than the card. Real card size is about 324.
 *   maxWidth       optional upper limit for `width`
 *   sideBySide     show front and back next to each other when there is room
 *   showBack       render the back side too (default true)
 *   showDownload   render the "Download PDF" button under the card (default true)
 *   fileName       PDF file name (default: library-card-<id_no>.pdf)
 *   className      extra classes for the outer wrapper
 *
 * How it is built
 *   The card is drawn on a fixed 856 x 540 px artboard (CR80, 85.6 x 54 mm at
 *   10 px/mm) and scaled down with CSS to fit its container, so it looks the
 *   same at every size and the PDF export is always full resolution.
 *   Barcode (Code 128) and QR code are generated in the browser from the data.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import interRegularUrl from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import interBoldUrl from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import robotoCondensedUrl from "@fontsource/roboto-condensed/files/roboto-condensed-latin-400-normal.woff2?url";
import notoSerifUrl from "@fontsource-variable/noto-serif/files/noto-serif-latin-wdth-normal.woff2?url";

// ---------------------------------------------------------------- constants

const W = 856; // artboard size in px (CR80 proportions: 85.6 x 54 mm)
const H = 540;

const COLOR = {
  gold: "#b5a16c",
  navy: "#1e334e",
  beige: "#e9e9df",
  paper: "#f0f0ec",
  title: "#f5f3ed",
  ink: "#151714",
  band: "#151614",
  bars: "#141413",
  rule: "#252724",
  tile: "#efefee",
};

// Fonts: titles = Noto Serif Bold (condensed width), name/ID/etc. = Inter,
// back-of-card text, digits and signature label = Roboto Condensed. Latin subsets only, loaded
// from the npm packages (no Google Fonts request), under private family names
// so they never clash with the rest of the app.
const FONT_FACES = [
  { family: "LC Inter", weight: "400", url: interRegularUrl },
  { family: "LC Inter", weight: "700", url: interBoldUrl },
  { family: "LC Roboto Condensed", weight: "400", url: robotoCondensedUrl },
  { family: "LC Noto Serif", weight: "100 900", stretch: "62.5% 100%", url: notoSerifUrl },
];

// Where the baseline sits inside a line box of height = font-size, per font
// (so text can be positioned by its baseline, like in Figma).
const FONT = {
  serif: { css: '"LC Noto Serif", "Noto Serif", Georgia, "Times New Roman", serif', base: 0.888 },
  sans: { css: '"LC Inter", Inter, "Helvetica Neue", Arial, sans-serif', base: 0.8637 },
  cond: { css: '"LC Roboto Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif', base: 0.8418 },
};

const TERMS = [
  ["This card is non-transferable and valid only for the registered", "student."],
  ["Must be presented when borrowing or returning library materials."],
  ["Loss of card must be reported immediately to the", "Circulation Desk."],
  ["All books must be returned before final clearance."],
];

// One entry per printed line, with its baseline (y) and whether it starts a bullet.
const BACK_BASELINES = [245.7, 281.1, 316.5, 352, 387.4, 422.7];
const TERMS_LINES = TERMS.flatMap((item) => item.map((text, i) => ({ text, bullet: i === 0 })))
  .map((l, idx) => ({ ...l, y: BACK_BASELINES[idx] }));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ------------------------------------------------------------------ helpers

let fontsInjected = false;
function ensureFontFaces() {
  if (fontsInjected || typeof document === "undefined") return;
  fontsInjected = true;
  const css = FONT_FACES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};` +
      `${f.stretch ? `font-stretch:${f.stretch};` : ""}font-display:swap;src:url(${f.url}) format("woff2");}`
  ).join("\n");
  const style = document.createElement("style");
  style.setAttribute("data-library-card-fonts", "");
  style.textContent = css;
  document.head.appendChild(style);
}

function loadFonts() {
  ensureFontFaces();
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all(FONT_FACES.map((f) => document.fonts.load(`${f.weight.split(" ")[0]} 24px "${f.family}"`)));
}

// Fonts as base64 CSS, handed to html-to-image so the PDF uses the exact fonts.
let fontEmbedCache = null;
async function buildFontEmbedCss() {
  if (fontEmbedCache) return fontEmbedCache;
  const toBase64 = (buf) => {
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const rules = await Promise.all(
    FONT_FACES.map(async (f) => {
      const res = await fetch(f.url);
      const b64 = toBase64(await res.arrayBuffer());
      return (
        `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};` +
        `${f.stretch ? `font-stretch:${f.stretch};` : ""}src:url(data:font/woff2;base64,${b64}) format("woff2");}`
      );
    })
  );
  fontEmbedCache = rules.join("\n");
  return fontEmbedCache;
}

function formatExp(v) {
  if (!v) return "";
  if (v instanceof Date) return `${MONTHS[v.getMonth()]} ${v.getFullYear()}`;
  const m = /^(\d{4})-(\d{2})/.exec(String(v));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(v);
}

// Accepts the component's own field names and the Django API's.
function normalizeStudent(s = {}) {
  return {
    name: s.name ?? s.full_name ?? "",
    id_no: String(s.id_no ?? s.student_id ?? ""),
    department: s.department ?? "",
    session: s.session ?? "",
    exp_date: formatExp(s.exp_date ?? s.valid_thru),
    photo: s.photo ?? s.photo_url ?? "",
  };
}

// 1D barcode (Code 128) -> a string of 1 (bar) / 0 (space) modules.
function code128Modules(value) {
  if (!value) return "";
  try {
    const out = {};
    JsBarcode(out, String(value), { format: "CODE128" });
    return out.encodings.map((e) => e.data).join("");
  } catch {
    return "";
  }
}

// QR code -> SVG path data (one square per dark module) + its size.
function qrPath(value) {
  if (!value) return null;
  try {
    const qr = QRCode.create(String(value), { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let d = "";
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) if (qr.modules.get(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { d, n };
  } catch {
    return null;
  }
}

// Loads an image as a data URL (needed so the PDF export isn't blocked by
// cross-origin images). Falls back to the plain URL if the server refuses.
function useInlineImage(url) {
  // Remember which URL the loaded data belongs to, so a changed URL shows the
  // plain URL straight away instead of stale data (no setState needed in the effect body).
  const [loaded, setLoaded] = useState({ url: "", dataUrl: "" });
  useEffect(() => {
    if (!url || url.startsWith("data:")) return undefined;
    let cancelled = false;
    fetch(url, { mode: "cors" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!cancelled) setLoaded({ url, dataUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return "";
  return loaded.url === url ? loaded.dataUrl : url;
}

// Shrinks a font size until the text fits `maxWidth` (long names/departments).
function useFitSize(ref, base, maxWidth, deps) {
  const [size, setSize] = useState(base);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let alive = true;
    const run = () => {
      let s = base;
      el.style.fontSize = `${s}px`;
      while (el.scrollWidth > maxWidth && s > base * 0.55) {
        s -= 0.5;
        el.style.fontSize = `${s}px`;
      }
      if (alive) setSize(s);
    };
    run();
    document.fonts?.ready.then(run);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, maxWidth, ...deps]);
  return size;
}

// -------------------------------------------------------------- primitives

// Text placed by its BASELINE (y) and x - left edge, or centre if `center`.
function Txt({ font, size, x, y, center = false, color = COLOR.ink, weight = 400, stretch, children, innerRef }) {
  const f = FONT[font];
  const style = {
    position: "absolute",
    top: y - f.base * size,
    fontFamily: f.css,
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1,
    whiteSpace: "nowrap",
    color,
    ...(stretch ? { fontStretch: stretch } : {}),
    ...(center ? { left: x - W, width: W * 2, textAlign: "center" } : { left: x }),
  };
  return (
    <div ref={innerRef} style={style}>
      {children}
    </div>
  );
}

function Field({ label, value, y }) {
  const ref = useRef(null);
  const size = useFitSize(ref, 34.2, 561, [value]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 255,
        top: y - FONT.sans.base * size,
        fontFamily: FONT.sans.css,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: COLOR.ink,
      }}
    >
      <span style={{ fontWeight: 700 }}>{label}</span> {value}
    </div>
  );
}

// Fallback logo: a clean shield + open book + laurel emblem.
function Emblem() {
  const leaves = [];
  [-1, 1].forEach((side) => {
    for (let theta = 100; theta < 240; theta += 20) {
      const rad = (theta * Math.PI) / 180;
      let x = 50 + 41 * Math.cos(rad);
      const y = 52 + 41 * Math.sin(rad);
      if (side === 1) x = 100 - x;
      leaves.push({ x, y, a: (theta + 75) * side, k: `${side}${theta}` });
    }
  });
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      {leaves.map((l) => (
        <ellipse key={l.k} cx={l.x} cy={l.y} rx="6.5" ry="2.7" fill="#c8a858" transform={`rotate(${l.a} ${l.x} ${l.y})`} />
      ))}
      <path d="M27 20 H73 V48 C73 66 62 76 50 82 C38 76 27 66 27 48 Z" fill="#2c4479" stroke="#c8a858" strokeWidth="2.2" />
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M50 36 C${50 + side * 6} 33 ${50 + side * 14} 33 ${50 + side * 18} 35 L${50 + side * 18} 59 C${50 + side * 14} 57 ${50 + side * 6} 57 50 60 Z`}
          fill="#f5f0e1"
          stroke="#c8a858"
          strokeWidth="0.9"
        />
      ))}
    </svg>
  );
}

// Fallback photo: neutral silhouette.
function PhotoPlaceholder() {
  return (
    <svg viewBox="0 0 100 120" className="h-full w-full" aria-hidden="true">
      <rect width="100" height="120" fill="#cfd2d6" />
      <circle cx="50" cy="45" r="19" fill="#9aa0a8" />
      <path d="M12 120c0-26 17-42 38-42s38 16 38 42z" fill="#9aa0a8" />
    </svg>
  );
}

function Barcode({ modules }) {
  if (!modules) return null;
  let d = "";
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let j = i;
      while (j < modules.length && modules[j] === "1") j += 1;
      d += `M${i} 0h${j - i}v1h-${j - i}z`;
      i = j;
    } else i += 1;
  }
  return (
    <svg
      viewBox={`0 0 ${modules.length} 1`}
      preserveAspectRatio="none"
      className="absolute left-[67px] top-[402px] h-[75px] w-[430px]"
      role="img"
      aria-label="Barcode"
      shapeRendering="crispEdges"
    >
      <path d={d} fill={COLOR.bars} />
    </svg>
  );
}

// -------------------------------------------------------------------- front

function CardFront({ s, barcodeValue, logo, signature, universityName, cardTitle }) {
  const code = barcodeValue || s.id_no;
  const modules = useMemo(() => code128Modules(code), [code]);
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <>
      {/* bands */}
      <div className="absolute left-0 top-0 h-[7px] w-full bg-[#b5a16c]" />
      <div className="absolute left-0 top-[7px] h-[116px] w-full bg-[#1e334e]" />
      <div className="absolute left-0 top-[123px] h-[8px] w-full bg-[#b5a16c]" />
      <div className="absolute left-0 top-[131px] h-[254px] w-full bg-[#e9e9df]" />

      {/* logo: the built-in BGC logo sits at the exact position/size from the Figma PNG */}
      {logo === BGC_LOGO && !logoFailed ? (
        <img
          src={BGC_LOGO}
          alt="BGC Trust University"
          draggable={false}
          onError={() => setLogoFailed(true)}
          style={{ position: "absolute", left: 35.6, top: 16.6, width: 103.5, height: 97.4 }}
        />
      ) : (
        <div className="absolute left-[38px] top-[19px] flex h-[93px] w-[99px] items-center justify-center">
          {logo && logo !== BGC_LOGO ? (
            <img src={logo} alt="" onError={() => setLogoFailed(true)} className="max-h-full max-w-full object-contain" />
          ) : (
            <Emblem />
          )}
        </div>
      )}

      {/* header text */}
      <Txt font="serif" size={43.2} x={490} y={65.6} center color={COLOR.title} weight={700} stretch="75%">
        {universityName}
      </Txt>
      <Txt font="serif" size={34.4} x={490} y={110} center color={COLOR.title} weight={700} stretch="75%">
        {cardTitle}
      </Txt>

      {/* photo */}
      <div className="absolute left-[48px] top-[152px] h-[217px] w-[180px] overflow-hidden bg-[#cfcfc9]">
        {s.photo ? (
          <img src={s.photo} alt="" className="h-full w-full object-cover object-[50%_25%]" />
        ) : (
          <PhotoPlaceholder />
        )}
      </div>

      {/* details */}
      <Field label="Name:" value={s.name} y={180.4} />
      <Field label="ID No:" value={s.id_no} y={224.6} />
      <Field label="Department:" value={s.department} y={268.3} />
      <Field label="Session:" value={s.session} y={312.6} />
      <Field label="Exp Date:" value={s.exp_date} y={356.9} />

      {/* barcode from id_no + its digits */}
      <Barcode modules={modules} />
      <Txt font="cond" size={30.7} x={282} y={509} center>
        {code}
      </Txt>

      {/* signature */}
      <Txt font="cond" size={24.9} x={701} y={425} center>
        Chief Librarian:
      </Txt>
      {signature && (
        <img src={signature} alt="" className="absolute left-[606px] top-[438px] h-[41px] w-[176px] object-contain" />
      )}
      <div className="absolute left-[581px] top-[488px] h-[1.5px] w-[225px] bg-[#252724]" />
    </>
  );
}

// --------------------------------------------------------------------- back

function CardBack({ qrValue }) {
  const qr = useMemo(() => qrPath(qrValue), [qrValue]);
  return (
    <>
      <div className="absolute left-0 top-0 h-[7px] w-full bg-[#b5a16c]" />
      <div className="absolute left-0 top-[7px] h-[33px] w-full bg-[#1e334e]" />
      <div className="absolute left-0 top-[40px] h-[83px] w-full bg-[#151614]" />
      <div className="absolute left-0 top-[123px] h-[8px] w-full bg-[#b5a16c]" />

      <Txt font="serif" size={40.9} x={427} y={196.4} center color={COLOR.navy} weight={700} stretch="75%">
        TERMS &amp; CONDITIONS
      </Txt>

      {TERMS_LINES.map((l) => (
        <div key={l.text}>
          {l.bullet && (
            <Txt font="cond" size={29.1} x={47} y={l.y} color="#101410">
              •
            </Txt>
          )}
          <Txt font="cond" size={29.1} x={61} y={l.y} color="#101410">
            {l.text}
          </Txt>
        </div>
      ))}

      <Txt font="cond" size={29.2} x={47} y={481.3} color="#101410">
        If found, please return to:
      </Txt>
      <Txt font="cond" size={29.2} x={47} y={513.4} color="#101410">
        Central University Library, Circulation Desk
      </Txt>

      {qr && (
        <div className="absolute left-[705px] top-[411px] h-[107px] w-[107px] bg-[#efefee] p-[5px]">
          <svg viewBox={`0 0 ${qr.n} ${qr.n}`} className="block h-full w-full" shapeRendering="crispEdges" role="img" aria-label="QR code">
            <path d={qr.d} fill="#111" />
          </svg>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------- scaled artboard

function Artboard({ innerRef, label, bg = COLOR.paper, width = W, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / W) || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrapRef} style={{ width, maxWidth: "100%" }}>
      <div
        style={{
          width: W * scale,
          height: H * scale,
          borderRadius: 24 * scale,
          boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        }}
      >
        <div
          ref={innerRef}
          role="img"
          aria-label={label}
          className="relative overflow-hidden rounded-[24px]"
          style={{ width: W, height: H, background: bg, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- component

function LibraryCardInner({
  student,
  logoUrl = BGC_LOGO,
  signatureUrl,
  qrValue,
  barcodeValue,
  universityName = "BGC TRUST UNIVERSITY LIBRARY",
  cardTitle = "STUDENT LIBRARY CARD",
  width = 400,
  maxWidth,
  sideBySide = false,
  showBack = true,
  showDownload = true,
  fileName,
  className = "",
}) {
  const s = useMemo(() => normalizeStudent(student), [student]);
  const photo = useInlineImage(s.photo);
  const logo = useInlineImage(logoUrl);
  const signature = useInlineImage(signatureUrl);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFonts();
  }, []);

  const handleDownload = async () => {
    setBusy(true);
    setError("");
    try {
      await loadFonts();
      await document.fonts?.ready;
      const [{ toPng }, { jsPDF }, fontEmbedCSS] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
        buildFontEmbedCss(),
      ]);
      // Capture each side at its natural 856 x 540 size (undo the on-screen scale).
      const opts = { pixelRatio: 2, width: W, height: H, cacheBust: false, fontEmbedCSS, style: { transform: "none" } };
      const frontPng = await toPng(frontRef.current, opts);
      const backPng = showBack && backRef.current ? await toPng(backRef.current, opts) : null;

      // A4 page, both sides at real card size (85.6 x 54 mm), like a printable sheet.
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const cw = 85.6;
      const ch = 54;
      const x = (210 - cw) / 2;
      pdf.setTextColor(22, 24, 29);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Student Library Card", 105, 28, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text("Print at 100% scale to get the actual card size.", 105, 34, { align: "center" });
      // Just the two cards, like a printable sheet (the FRONT / BACK captions are only on the web page).
      pdf.addImage(frontPng, "PNG", x, 46, cw, ch, "card-front", "FAST");
      if (backPng) pdf.addImage(backPng, "PNG", x, 46 + ch + 12, cw, ch, "card-back", "FAST");
      pdf.save(fileName || `library-card-${s.id_no || "student"}.pdf`);
    } catch {
      setError("Couldn't create the PDF. If the photo is hosted on another server, it must allow cross-origin (CORS) access.");
    } finally {
      setBusy(false);
    }
  };

  // A fixed card size (it never stretches to fill the page).
  const cardWidth = Math.round(Math.min(width, maxWidth ?? Infinity));

  return (
    <div className={`w-full ${className}`}>
      <div className={`flex gap-6 ${sideBySide ? "flex-row flex-wrap" : "flex-col"}`}>
        <figure className="m-0" style={{ width: cardWidth, maxWidth: "100%" }}>
          <Artboard innerRef={frontRef} label={`Library card front for ${s.name}`} width={cardWidth}>
            <CardFront s={{ ...s, photo }} barcodeValue={barcodeValue} logo={logo} signature={signature} universityName={universityName} cardTitle={cardTitle} />
          </Artboard>
          <figcaption className="mt-2 text-center text-xs font-bold tracking-wide text-gray-700">FRONT</figcaption>
        </figure>

        {showBack && (
          <figure className="m-0" style={{ width: cardWidth, maxWidth: "100%" }}>
            <Artboard innerRef={backRef} label="Library card back" bg={COLOR.beige} width={cardWidth}>
              <CardBack qrValue={qrValue || s.id_no} />
            </Artboard>
            <figcaption className="mt-2 text-center text-xs font-bold tracking-wide text-gray-700">BACK</figcaption>
          </figure>
        )}
      </div>

      {showDownload && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Preparing PDF..." : "Download card (PDF)"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// Public component. If it's rendered without a student (for example when this
// file is accidentally used as the page itself), say so instead of showing a blank card.
export default function LibraryCard(props) {
  if (!props.student) {
    return (
      <div className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">This is the LibraryCard component, and it needs a <code>student</code> prop.</p>
        <p className="mt-1">
          If you see this on the Library Card page, the wrong file is in <code>src/pages/LibraryCard.jsx</code>. Put
          the <b>page</b> file there, and keep this component file in <code>src/components/LibraryCard.jsx</code>.
        </p>
      </div>
    );
  }
  return <LibraryCardInner {...props} />;
}


// ---------------------------------------------------------------------------
// BUILT-IN LOGO DATA - the BGC Trust University logo, cut from the Figma card
// PNG (transparent background, 4x smoothed, 16 KB). Nothing to edit here.
// ---------------------------------------------------------------------------
const BGC_LOGO =
  "data:image/png;base64,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";
