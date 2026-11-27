/**
 * Payments - pay the library card fee and fines online with bKash or Nagad.
 *
 * Flow:  Review (choose what to pay + method)  ->  Pay (confirm with PIN)  ->  Receipt
 *
 * The page never decides amounts: the server quotes them (GET /payments/summary/),
 * re-checks them when the payment is created and again when it is confirmed.
 * Everything below is presentation + a small amount of local state.
 *
 * Sections of this file:
 *   1. constants & helpers      4. receipt (screen + PDF)
 *   2. small UI pieces          5. history
 *   3. checkout pieces          6. the page itself
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../api/AuthContext";
import { formatDate } from "../utils/formatDate";

// ───────────────────────────────────────────────────────── 1. constants & helpers

const PROVIDERS = {
  bkash: { key: "bkash", name: "bKash", tagline: "Pay with your bKash account", color: "#E2136E", soft: "#FDECF4" },
  nagad: { key: "nagad", name: "Nagad", tagline: "Pay with your Nagad account", color: "#F6921E", soft: "#FEF3E3" },
};
const PURPOSE_LABEL = { card_fee: "Library card fee", fines: "Fines" };

const taka = (n) => `${Number(n || 0).toLocaleString("en-US")} BDT`;

// Bangladeshi mobile numbers: 11 digits, 013-019 prefix. Accepts +880…, 880…, spaces, dashes.
function normalizeNumber(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+88")) d = d.slice(3);
  else if (d.startsWith("88") && d.length >= 13) d = d.slice(2);
  return d.replace(/\D/g, "").slice(0, 11);
}
const isValidNumber = (n) => /^01[3-9]\d{8}$/.test(n);
const maskNumber = (n) => (n && n.length === 11 ? `${n.slice(0, 5)}•••${n.slice(8)}` : n || "");

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

// Sandbox payments get a "SBX…" transaction id, so a receipt can always say whether it was a test.
const isTestPayment = (p) => String(p?.provider_trx_id || "").startsWith("SBX");

const store = {
  get(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode / storage blocked: remembering the number is only a convenience */
    }
  },
};

function errorText(err, fallback) {
  const d = err.response?.data;
  return (typeof d?.detail === "string" && d.detail) || fallback;
}

function paymentTitle(p) {
  if (p.purpose === "card_fee") return "Library card fee";
  const books = (p.lines || []).map((l) => l.book_title);
  if (books.length === 0) return "Fines";
  return books.length === 1 ? `Fine · ${books[0]}` : `Fines · ${books.length} books`;
}

// ───────────────────────────────────────────────────────── 2. small UI pieces

const ICONS = {
  check: "M5 13l4 4L19 7",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  download: "M12 4v11m0 0l-4-4m4 4l4-4M5 20h14",
  book: "M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z",
  idcard: "M3 6h18v12H3zM9 11.5a1.5 1.5 0 1 0 0-.01M6.5 15.5c.5-1.3 1.4-2 2.5-2s2 .7 2.5 2M14 10h4M14 14h3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.7A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 3.4-.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  x: "M6 6l12 12M18 6L6 18",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  arrow: "M5 12h14m-6-6l6 6-6 6",
};

function Icon({ name, className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Spinner({ className = "h-4 w-4" }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />;
}

function Card({ className = "", children }) {
  return <section className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

function StatusBadge({ status }) {
  const map = {
    completed: ["Paid", "bg-green-50 text-green-700 ring-green-600/15"],
    pending: ["Pending", "bg-amber-50 text-amber-700 ring-amber-600/15"],
    failed: ["Failed", "bg-red-50 text-red-600 ring-red-600/15"],
  };
  const [text, cls] = map[status] || map.pending;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{text}</span>;
}

function TestPill() {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">TEST</span>;
}

function Stepper({ step }) {
  const steps = ["Review", "Pay", "Receipt"];
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Payment progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-blue-600 text-white" : current ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-gray-200 text-gray-500"
              }`}
            >
              {done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={current ? "font-semibold text-gray-900" : "text-gray-500"}>{label}</span>
            {n < steps.length && <span className={`mx-1 h-px w-8 ${done ? "bg-blue-600" : "bg-gray-300"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function PageSkeleton() {
  const bar = "animate-pulse rounded-lg bg-gray-200";
  return (
    <div aria-busy="true" aria-label="Loading payments">
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} mt-3 h-4 w-80`} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className={`${bar} h-72`} />
          <div className={`${bar} h-56`} />
        </div>
        <div className={`${bar} h-64`} />
      </div>
    </div>
  );
}

function AllPaidUp({ cardActive }) {
  return (
    <Card className="mx-auto mt-8 max-w-xl text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
        <Icon name="check" className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-gray-900">You’re all paid up</h2>
      <p className="mt-1 text-sm text-gray-500">
        {cardActive ? "Your library card is active and you have no fines to pay." : "You have nothing to pay right now."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/my-fines" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          View my fines
        </Link>
        <Link to="/library-card" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {cardActive ? "View my library card" : "Library card"}
        </Link>
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────── 3. checkout pieces

function BillTabs({ bills, active, onChange }) {
  if (bills.length < 2) return null;
  return (
    <div role="tablist" aria-label="What to pay" className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
      {bills.map((b) => (
        <button
          key={b.key}
          type="button"
          role="tab"
          aria-selected={active === b.key}
          onClick={() => onChange(b.key)}
          className={`rounded-lg px-4 py-2.5 text-left transition ${active === b.key ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
        >
          <span className="block text-sm font-semibold text-gray-900">{b.title}</span>
          <span className="block text-xs text-gray-500">{taka(b.total)}</span>
        </button>
      ))}
    </div>
  );
}

function FineList({ items, perDay, deselected, onToggle, onToggleAll }) {
  const selectedCount = items.filter((i) => !deselected.includes(i.id)).length;
  const allOn = selectedCount === items.length;
  const hasOverdue = items.some((i) => i.state === "overdue");
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={allOn} onChange={onToggleAll} />
          Select all
        </label>
        <span className="text-xs text-gray-500">
          {selectedCount} of {items.length} selected
        </span>
      </div>

      <ul className="space-y-3">
        {items.map((l) => {
          const on = !deselected.includes(l.id);
          const overdue = l.state === "overdue";
          const days = overdue && perDay ? Math.round(l.fine_so_far / perDay) : 0;
          return (
            <li key={l.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  on ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-white opacity-70 hover:opacity-100"
                }`}
              >
                <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" checked={on} onChange={() => onToggle(l.id)} />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-gray-200">
                  <Icon name="book" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{l.book_title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {overdue
                      ? `Due ${formatDate(l.due_date)} · not returned · ${days} day${days === 1 ? "" : "s"} overdue`
                      : `Returned ${formatDate(l.return_date)}`}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {overdue && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        +{perDay} BDT every day until returned
                      </span>
                    )}
                    {l.paid > 0 && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        {taka(l.paid)} already paid
                      </span>
                    )}
                  </span>
                  {overdue && days > 0 && (
                    <span className="mt-1.5 block text-[11px] text-gray-400">
                      {days} days × {perDay} BDT = {taka(l.fine_so_far)}
                      {l.paid > 0 ? ` − ${taka(l.paid)} paid` : ""}
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block text-base font-bold text-gray-900">{taka(l.outstanding)}</span>
                  <span className="block text-[11px] text-gray-400">to pay</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {hasOverdue && (
        <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>
            Overdue books add {perDay} BDT a day until they are returned. Pay what you owe now; new days show up as a new
            balance, and anything you have paid is credited when you return the book.
          </span>
        </p>
      )}
    </div>
  );
}

function CardFeeInfo({ fee }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-gray-200">
        <Icon name="idcard" className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">Student library card</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
          One-time fee. Your card is issued right after payment, and you can view it and download it as a PDF from the
          Library Card page. You can request books once it is active.
        </span>
      </span>
      <span className="text-right">
        <span className="block text-base font-bold text-gray-900">{taka(fee)}</span>
        <span className="block text-[11px] text-gray-400">one-time</span>
      </span>
    </div>
  );
}

function MethodPicker({ provider, onChange }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
      {Object.values(PROVIDERS).map((p) => {
        const on = provider === p.key;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(p.key)}
            className="relative flex items-center gap-3 rounded-xl border-2 bg-white p-4 text-left transition hover:shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            style={{ borderColor: on ? p.color : "#E5E7EB", background: on ? p.soft : "#fff" }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: p.color }}>
              {p.name[0]}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-900">{p.name}</span>
              <span className="block truncate text-xs text-gray-500">{p.tagline}</span>
            </span>
            {on && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: p.color }}>
                <Icon name="check" className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({ provider, value, onChange, onBlur, error, inputRef }) {
  const p = PROVIDERS[provider];
  return (
    <div className="mt-5">
      <label htmlFor="sender" className="block text-sm font-medium text-gray-700">
        {p.name} account number
      </label>
      <div className={`mt-1.5 flex overflow-hidden rounded-xl border bg-white focus-within:ring-4 ${error ? "border-red-400 focus-within:ring-red-100" : "border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-100"}`}>
        <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-500">+88</span>
        <input
          id="sender"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="01XXXXXXXXX"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby="sender-hint"
          className="w-full bg-transparent px-3 py-3 text-base tracking-wide text-gray-900 outline-none placeholder:text-gray-400"
        />
        {isValidNumber(value) && (
          <span className="flex items-center pr-3 text-green-600" aria-label="Valid number">
            <Icon name="check" className="h-5 w-5" />
          </span>
        )}
      </div>
      <p id="sender-hint" className={`mt-1.5 text-xs ${error ? "text-red-600" : "text-gray-500"}`} aria-live="polite">
        {error || `Use the number registered with ${p.name}. The amount is requested from this account.`}
      </p>
    </div>
  );
}

function OrderSummary({ bill, lines, total, provider, canPay, hint, busy, gatewayReady }) {
  const p = PROVIDERS[provider];
  return (
    <aside aria-label="Payment summary" className="lg:sticky lg:top-6">
      <Card>
        <h2 className="text-base font-bold text-gray-900">Payment summary</h2>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between font-medium text-gray-900">
            <span>{bill.title}</span>
            <span>{taka(total)}</span>
          </div>
          {lines.length > 1 &&
            lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-3 pl-3 text-xs text-gray-500">
                <span className="truncate">{l.book_title}</span>
                <span className="whitespace-nowrap">{taka(l.outstanding)}</span>
              </div>
            ))}
          <div className="flex justify-between text-gray-500">
            <span>Processing fee</span>
            <span className="font-medium text-green-700">Free</span>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-extrabold text-gray-900">{taka(total)}</span>
        </div>

        <button
          type="submit"
          disabled={busy || !gatewayReady || total <= 0}
          aria-disabled={!canPay}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 ${canPay ? "hover:brightness-95" : "opacity-60"}`}
          style={{ background: p.color }}
        >
          {busy ? <Spinner /> : <Icon name="lock" />}
          {busy ? "Please wait…" : `Pay ${taka(total)}`}
        </button>

        <p className="mt-2 min-h-[1rem] text-center text-xs text-gray-500" aria-live="polite">
          {hint || `Next, you’ll confirm with your ${p.name} PIN.`}
        </p>

        <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <li className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-green-600" />Instant receipt you can download</li>
          <li className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-green-600" />Your balance updates immediately</li>
          <li className="flex items-center gap-2"><Icon name="shield" className="h-3.5 w-3.5 text-green-600" />The server checks every amount for you</li>
        </ul>
      </Card>
    </aside>
  );
}

// The PIN step. Closes with Esc or a click outside (unless a payment is being processed).
function PinDialog({ payment, mode, busy, error, onConfirm, onCancel }) {
  const p = PROVIDERS[payment.provider];
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const submit = (e) => {
    e.preventDefault();
    if (pin.length >= 4 && !busy) onConfirm(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-4 backdrop-blur-[1px] sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pin-title" className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-6 pb-5 pt-6 text-white" style={{ background: p.color }}>
          <div className="flex items-center justify-between">
            <span id="pin-title" className="text-sm font-semibold opacity-90">Confirm with {p.name}</span>
            <button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel payment" className="rounded-full p-1 opacity-80 hover:bg-white/20 hover:opacity-100 disabled:opacity-40">
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-3xl font-extrabold">{taka(payment.amount)}</p>
          <p className="mt-1 text-xs opacity-90">to Central Library · {payment.purpose === "card_fee" ? "Library card fee" : "Fines"}</p>
        </div>

        <div className="px-6 py-5">
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-gray-500">From</dt><dd className="font-medium text-gray-900">{maskNumber(payment.sender_number)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Reference</dt><dd className="font-medium text-gray-900">{payment.reference}</dd></div>
          </dl>

          <label htmlFor="pin" className="mt-5 block text-sm font-medium text-gray-700">Enter your {p.name} PIN</label>
          <div className="relative mt-1.5">
            <input
              id="pin"
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={5}
              value={pin}
              disabled={busy}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-gray-300 py-3 pl-4 pr-11 text-center text-xl font-semibold tracking-[0.6em] text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-50"
              aria-describedby="pin-help"
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide PIN" : "Show PIN"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:text-gray-700">
              <Icon name={show ? "eyeOff" : "eye"} className="h-5 w-5" />
            </button>
          </div>
          <p id="pin-help" className="mt-1.5 text-xs text-gray-500">4 or 5 digits</p>

          {error && (
            <p className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {mode === "sandbox" && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
              <strong>Test mode:</strong> any 4 or 5 digit PIN works. Use <strong>0000</strong> to see a declined payment.
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={busy || pin.length < 4} className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ background: p.color }}>
              {busy ? <><Spinner /> Processing…</> : `Pay ${taka(payment.amount)}`}
            </button>
          </div>
          {busy && <p className="mt-3 text-center text-xs text-gray-500">Please don’t close this window.</p>}
        </div>
      </form>
    </div>
  );
}

function FailureCard({ failure, onRetry, onDismiss }) {
  return (
    <div className="mb-6 flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-red-900">Payment didn’t go through</h2>
        <p className="mt-1 text-sm text-red-800">{failure.message}</p>
        <p className="mt-1 text-xs text-red-700">Your balance hasn’t changed. You can try again.</p>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={onRetry} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Try again
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── 4. receipt (screen + PDF)

async function downloadReceiptPdf(payment, { studentName }) {
  const { jsPDF } = await import("jspdf"); // loaded only when someone downloads a receipt
  const doc = new jsPDF({ unit: "mm", format: "a5" }); // 148 x 210
  const W = 148;
  const test = isTestPayment(payment);

  doc.setFillColor(30, 51, 78);
  doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Central Library", 12, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Payment receipt", 12, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(W - 38, 12, 26, 9, 2, 2, "F");
  doc.text("PAID", W - 25, 18.2, { align: "center" });

  let y = 46;
  if (test) {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(12, y - 6, W - 24, 10, 2, 2, "F");
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8.5);
    doc.text("TEST PAYMENT - no real money was taken", W / 2, y, { align: "center" });
    y += 12;
  }

  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Amount paid", 12, y);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(taka(payment.amount), 12, y + 11);
  y += 24;

  const row = (label, value) => {
    doc.setDrawColor(229, 231, 235);
    doc.line(12, y - 4.5, W - 12, y - 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(label, 12, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(String(value), W - 12, y, { align: "right" });
    y += 9;
  };
  row("Paid for", PURPOSE_LABEL[payment.purpose] || payment.purpose);
  row("Receipt no.", payment.reference);
  row("Transaction ID", payment.provider_trx_id || "-");
  row("Payment method", PROVIDERS[payment.provider]?.name || payment.provider);
  row("Paid from", maskNumber(payment.sender_number));
  row("Date and time", fmtDateTime(payment.completed_at));
  if (studentName) row("Paid by", studentName);

  if (payment.lines?.length) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text("Items", 12, y);
    y += 7;
    payment.lines.forEach((ln) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      const title = doc.splitTextToSize(ln.book_title, 85);
      doc.text(title, 12, y);
      doc.setFont("helvetica", "bold");
      doc.text(taka(ln.amount), W - 12, y, { align: "right" });
      y += 5.5 * title.length + 1;
    });
  }

  doc.setDrawColor(209, 213, 219);
  doc.line(12, 190, W - 12, 190);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("This is a computer-generated receipt and needs no signature.", W / 2, 196, { align: "center" });
  doc.save(`receipt-${payment.reference}.pdf`);
}

function ReceiptView({ payment, fresh, remaining, studentName, onBack, onCard, onPayRest }) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const p = PROVIDERS[payment.provider];
  const test = isTestPayment(payment);

  const copy = async () => {
    const text = payment.provider_trx_id;
    let done = false;
    try {
      await navigator.clipboard.writeText(text); // needs https (or localhost) and permission
      done = true;
    } catch {
      // Fallback for plain-http pages / blocked clipboard API.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        done = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        done = false;
      }
    }
    if (done) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  const pdf = async () => {
    setPdfBusy(true);
    try {
      await downloadReceiptPdf(payment, { studentName });
    } finally {
      setPdfBusy(false);
    }
  };

  const details = [
    ["Paid for", PURPOSE_LABEL[payment.purpose]],
    ["Method", p?.name],
    ["Paid from", maskNumber(payment.sender_number)],
    ["Date and time", fmtDateTime(payment.completed_at)],
    ["Receipt no.", payment.reference],
  ];

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <style>{`@keyframes lc-draw{to{stroke-dashoffset:0}}@keyframes lc-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="bg-green-50 px-8 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white" style={{ animation: "lc-pop .45s ease-out both" }}>
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "lc-draw .4s .25s ease-out forwards" }} />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">{fresh ? "Payment successful" : "Payment receipt"}</h2>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900">{taka(payment.amount)}</p>
          <p className="mt-1 text-sm text-gray-600">paid to Central Library {test && <TestPill />}</p>
        </div>

        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Transaction ID</p>
              <p className="truncate text-sm font-semibold text-gray-900">{payment.provider_trx_id}</p>
            </div>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <dl className="mt-4 divide-y divide-gray-100 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>

          {payment.lines?.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Items paid</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {payment.lines.map((ln) => (
                  <li key={ln.loan_id} className="flex justify-between gap-3">
                    <span className="truncate text-gray-700">{ln.book_title}</span>
                    <span className="whitespace-nowrap font-semibold text-gray-900">{taka(ln.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fresh && payment.purpose === "fines" && payment.lines?.some((l) => l.book_title) && (
            <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              If a book is still overdue, new fines are added each day until it is returned.
            </p>
          )}

          {fresh && remaining > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                You still have <strong>{taka(remaining)}</strong> to pay.
              </p>
              <button type="button" onClick={onPayRest} className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-amber-900 hover:underline">
                Continue <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={pdf} disabled={pdfBusy} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {pdfBusy ? <Spinner /> : <Icon name="download" />}
              Download receipt (PDF)
            </button>
            {fresh && payment.purpose === "card_fee" && (
              <button type="button" onClick={onCard} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                View my library card
              </button>
            )}
            <button type="button" onClick={onBack} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              Back to Payments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── 5. history

function HistoryList({ history: allPayments, onOpenReceipt }) {
  const [filter, setFilter] = useState("all");
  // Show what matters to the student: payments that went through, and real declines.
  // Abandoned checkouts (a PIN box that was closed, or an attempt replaced by a newer one)
  // are just noise, so they are hidden.
  const history = allPayments.filter(
    (h) => h.status === "completed" || (h.status === "failed" && !String(h.failure_reason || "").startsWith("Replaced by"))
  );
  const shown = history.filter((h) => filter === "all" || (filter === "paid" ? h.status === "completed" : h.status === "failed"));
  const tabs = [
    ["all", "All"],
    ["paid", "Paid"],
    ["failed", "Failed"],
  ];
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">Payment history</h2>
        {history.length > 0 && (
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs font-medium" role="tablist" aria-label="Filter payments">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1 ${filter === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Icon name="receipt" className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-gray-700">No payments yet</p>
          <p className="text-xs text-gray-500">Your payments and receipts will appear here.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-6 py-4 text-center text-sm text-gray-500">No {filter} payments.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {shown.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: PROVIDERS[h.provider]?.color || "#6B7280" }}>
                {PROVIDERS[h.provider]?.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">
                  <span className="truncate">{paymentTitle(h)}</span>
                  {isTestPayment(h) && <TestPill />}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {PROVIDERS[h.provider]?.name} · {fmtDateTime(h.completed_at || h.created_at)} · {h.reference}
                </p>
                {h.status === "failed" && h.failure_reason && <p className="mt-0.5 truncate text-xs text-red-600">{h.failure_reason}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-900">{taka(h.amount)}</span>
                <StatusBadge status={h.status} />
                {h.status === "completed" && (
                  <button type="button" onClick={() => onOpenReceipt(h)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <Icon name="receipt" className="h-3.5 w-3.5" /> Receipt
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────── 6. the page

export default function Payments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentName = user ? [user.username, user.student_id && `(${user.student_id})`].filter(Boolean).join(" ") : "";

  const [summary, setSummary] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error

  const [bill, setBill] = useState(null); // "card_fee" | "fines"
  const [deselected, setDeselected] = useState([]); // fine items the student un-ticked
  const [provider, setProvider] = useState("bkash");
  const [numbers, setNumbers] = useState(() => ({
    bkash: normalizeNumber(store.get("lc.pay.bkash")),
    nagad: normalizeNumber(store.get("lc.pay.nagad")),
  }));
  const [touched, setTouched] = useState(false);
  const numberRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState("");
  const [pending, setPending] = useState(null); // created payment waiting for the PIN
  const [pinError, setPinError] = useState("");
  const [failure, setFailure] = useState(null);
  const [receipt, setReceipt] = useState(null); // { payment, fresh }

  const load = async () => {
    try {
      const res = await api.get("/payments/summary/");
      setSummary(res.data);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const number = numbers[provider];
  const numberError = number && !isValidNumber(number) && (touched || number.length === 11) ? "Enter a valid 11-digit mobile number starting with 013 to 019." : "";

  // ----- what can be paid -----
  const bills = useMemo(() => {
    if (!summary) return [];
    const list = [];
    if (summary.card.fee_due) list.push({ key: "card_fee", title: "Library card fee", total: summary.card.fee });
    if (summary.fines.total > 0) list.push({ key: "fines", title: "Fines", total: summary.fines.total });
    return list;
  }, [summary]);

  if (loadState === "loading") return <PageSkeleton />;
  if (loadState === "error") {
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <p className="font-semibold text-gray-900">Couldn’t load your payments</p>
        <p className="mt-1 text-sm text-gray-500">Check your connection and try again.</p>
        <button type="button" onClick={() => { setLoadState("loading"); load(); }} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Try again
        </button>
      </Card>
    );
  }

  const { card, fines, history, mode } = summary;
  const active = bills.find((b) => b.key === bill) || bills[0] || null;
  const chosen = fines.items.filter((i) => !deselected.includes(i.id));
  const chosenTotal = chosen.reduce((sum, i) => sum + i.outstanding, 0);
  const total = !active ? 0 : active.key === "fines" ? chosenTotal : card.fee;
  const remainingDue = (card.fee_due ? card.fee : 0) + fines.total;

  // why the pay button can't be used yet (shown under it)
  let hint = "";
  if (!summary.gateway_ready) hint = "Online payments aren’t available yet. Please pay at the circulation desk.";
  else if (active?.key === "fines" && chosen.length === 0) hint = "Select at least one fine to pay.";
  else if (!isValidNumber(number)) hint = `Enter your ${PROVIDERS[provider].name} number to continue.`;
  const canPay = !hint && total > 0;

  const step = receipt ? 3 : pending ? 2 : 1;

  const setNumber = (v) => setNumbers((n) => ({ ...n, [provider]: normalizeNumber(v) }));
  const toggleItem = (id) => setDeselected((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const toggleAll = () => setDeselected(deselected.length === 0 ? fines.items.map((i) => i.id) : []);

  const startPayment = async (e) => {
    e.preventDefault();
    if (!canPay) {
      setTouched(true);
      if (!isValidNumber(number)) numberRef.current?.focus();
      return;
    }
    setStartError("");
    setFailure(null);
    setBusy(true);
    try {
      const res = await api.post("/payments/create/", {
        provider,
        purpose: active.key,
        sender_number: number,
        ...(active.key === "fines" ? { loan_ids: chosen.map((i) => i.id) } : {}),
      });
      setPinError("");
      setPending(res.data);
    } catch (err) {
      setStartError(errorText(err, "Couldn’t start the payment. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async (pin) => {
    setPinError("");
    setBusy(true);
    try {
      const res = await api.post(`/payments/${pending.id}/confirm/`, { pin });
      store.set(`lc.pay.${pending.provider}`, pending.sender_number); // remember the number for next time
      setPending(null);
      setReceipt({ payment: res.data, fresh: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      load();
    } catch (err) {
      const d = err.response?.data;
      const message = errorText(err, "The payment didn’t go through.");
      if (!err.response || d?.status === "pending") {
        setPinError(!err.response ? "Network problem. Please try again." : message); // a typo: same payment, try again
      } else {
        setFailure({ message });
        setPending(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------ receipt screen
  if (receipt) {
    return (
      <div className="max-w-6xl">
        <Header />
        <div className="mt-5"><Stepper step={3} /></div>
        <ReceiptView
          payment={receipt.payment}
          fresh={receipt.fresh}
          remaining={remainingDue}
          studentName={studentName}
          onBack={() => setReceipt(null)}
          onCard={() => navigate("/library-card")}
          onPayRest={() => setReceipt(null)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------ main screen
  return (
    <div className="max-w-6xl">
      <Header />
      {mode === "sandbox" && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <Icon name="info" className="h-4 w-4 shrink-0" />
          <span><strong>Test mode:</strong> payments are simulated. No real money is taken from your bKash or Nagad account.</span>
        </p>
      )}

      {bills.length > 0 && <div className="mt-5"><Stepper step={step} /></div>}
      {failure && <div className="mt-5"><FailureCard failure={failure} onRetry={() => { setFailure(null); numberRef.current?.focus(); }} onDismiss={() => setFailure(null)} /></div>}
      {startError && (
        <p className="mt-5 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {startError}
        </p>
      )}

      {bills.length === 0 ? (
        <AllPaidUp cardActive={card.is_active} />
      ) : (
        <form onSubmit={startPayment} noValidate className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <h2 className="text-base font-bold text-gray-900">What would you like to pay?</h2>
              <p className="mb-4 mt-0.5 text-sm text-gray-500">Review the amount below. You can pay everything or just some of it.</p>
              <BillTabs bills={bills} active={active.key} onChange={setBill} />
              {active.key === "fines" ? (
                <FineList items={fines.items} perDay={fines.per_day} deselected={deselected} onToggle={toggleItem} onToggleAll={toggleAll} />
              ) : (
                <CardFeeInfo fee={card.fee} />
              )}
            </Card>

            <Card>
              <h2 className="text-base font-bold text-gray-900">Payment method</h2>
              <p className="mb-4 mt-0.5 text-sm text-gray-500">Choose how you’d like to pay.</p>
              <MethodPicker provider={provider} onChange={setProvider} />
              <NumberField provider={provider} value={number} onChange={setNumber} onBlur={() => setTouched(true)} error={numberError} inputRef={numberRef} />
            </Card>
          </div>

          <OrderSummary bill={active} lines={active.key === "fines" ? chosen : []} total={total} provider={provider} canPay={canPay} hint={hint} busy={busy && !pending} gatewayReady={summary.gateway_ready} />
        </form>
      )}

      <HistoryList history={history} onOpenReceipt={(p) => { setReceipt({ payment: p, fresh: false }); window.scrollTo({ top: 0 }); }} />

      {pending && (
        <PinDialog
          payment={pending}
          mode={mode}
          busy={busy}
          error={pinError}
          onConfirm={confirmPayment}
          onCancel={() => { setPending(null); setPinError(""); }}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
      <p className="mt-1 text-sm text-gray-500">Pay your library card fee and fines online with bKash or Nagad.</p>
    </div>
  );
}
