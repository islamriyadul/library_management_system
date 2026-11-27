import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import LibraryCardView from "../components/LibraryCard";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const FIELDS = [
  { key: "full_name", label: "Name", placeholder: "Enter your full name" },
  { key: "student_id", label: "Student ID", placeholder: "Enter your student ID" },
  { key: "department", label: "Department", placeholder: "Enter your department" },
  { key: "session", label: "Session", placeholder: "e.g. 2026–2027" },
  { key: "address", label: "Address", placeholder: "Enter your address" },
];

// Turns a DRF error response into { general, fields: {name: message} }.
function parseErrors(err, fallback) {
  const data = err.response?.data;
  if (!data) return { general: fallback, fields: {} };
  if (typeof data.detail === "string") return { general: data.detail, fields: {} };
  const fields = {};
  Object.entries(data).forEach(([k, v]) => {
    fields[k] = Array.isArray(v) ? v[0] : String(v);
  });
  return { general: "Please fix the highlighted fields.", fields };
}

// ---------------------------------------------------------------- form

function ApplicationForm({ previous, onSubmitted }) {
  const [form, setForm] = useState({
    full_name: previous?.full_name || "",
    student_id: previous?.student_id || "",
    department: previous?.department || "",
    session: previous?.session || "",
    address: previous?.address || "",
  });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!photo) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFieldErrors((f) => ({ ...f, photo: "" }));
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setFieldErrors((f) => ({ ...f, photo: "Photo must be a JPG or PNG image." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setFieldErrors((f) => ({ ...f, photo: "Photo must be 2 MB or smaller." }));
      return;
    }
    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!photo) {
      setFieldErrors({ photo: "Please upload your passport size photo." });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append("photo", photo);
      await api.post("/library-card/apply/", body);
      onSubmitted();
    } catch (err) {
      const { general, fields } = parseErrors(err, "Couldn't submit your application. Please try again.");
      setError(general);
      setFieldErrors(fields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-2 max-w-3xl rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
    >
      {/* Heading on the left, passport photo upload on the top right */}
      <div className="flex items-start justify-between gap-6">
        <div className="border-l-4 border-blue-600 pl-3">
          <h1 className="text-xl font-bold text-gray-900">Library card registration</h1>
          <p className="mt-0.5 text-sm text-gray-500">Enter your details to register for a library card.</p>
        </div>

        <div className="shrink-0 text-center">
          <label
            htmlFor="card-photo"
            className="flex aspect-[7/9] w-28 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 hover:border-blue-400"
          >
            {preview ? (
              <img src={preview} alt="Your passport size photo" className="h-full w-full object-cover" />
            ) : (
              <>
                <span className="text-2xl leading-none">+</span>
                <span className="mt-1 px-2">Upload photo</span>
              </>
            )}
          </label>
          <input id="card-photo" type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
          <p className="mt-1.5 text-[11px] text-gray-400">Passport size · JPG/PNG · max 2 MB</p>
          {fieldErrors.photo && <p className="mt-1 max-w-[7rem] text-[11px] text-red-600">{fieldErrors.photo}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="mb-1.5 block text-sm font-medium text-gray-700">
              {f.label}:
            </label>
            <input
              id={f.key}
              required
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white"
            />
            {fieldErrors[f.key] && <p className="mt-1 text-xs text-red-600">{fieldErrors[f.key]}</p>}
          </div>
        ))}
      </div>

      {error && <p className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Submitting..." : "Apply"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- states

function PendingView({ onRefresh, checking }) {
  const steps = [
    { n: "01", text: "Application submitted", done: true },
    { n: "02", text: "Librarian review in progress" },
    { n: "03", text: "Payment available after approval" },
  ];
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Library card application</h1>
      <p className="mt-1 text-sm text-gray-500">Track your application from submission to approval.</p>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <span className="inline-block rounded-md bg-amber-50 px-3 py-1 text-[11px] font-bold tracking-wide text-amber-800">
          AWAITING APPROVAL
        </span>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Your application has been submitted.</h2>
        <p className="mt-3 text-sm text-gray-500">
          Your librarian will review your details. Once approved, you can pay the library card fee from Payments.
        </p>

        <ul className="mt-8 space-y-3 text-sm">
          {steps.map((s) => (
            <li key={s.n} className={s.done ? "font-medium text-green-700" : "text-gray-600"}>
              <span className="mr-3 font-semibold">{s.n}</span>
              {s.text}
            </li>
          ))}
        </ul>

        <button
          onClick={onRefresh}
          disabled={checking}
          className="mt-8 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {checking ? "Checking..." : "Check approval status"}
        </button>
      </div>
    </>
  );
}

function ApprovedView({ application }) {
  const navigate = useNavigate();
  // Redirect to Payments automatically, but only the first time the student
  // sees the approval - otherwise coming back to this page would bounce them
  // to Payments every time.
  const seenKey = `card-approved-seen-${application.id}`;
  const [seconds, setSeconds] = useState(() => (sessionStorage.getItem(seenKey) ? null : 5));

  // Mark the approval as seen right away, so leaving mid-countdown doesn't
  // trigger the redirect again on the next visit.
  useEffect(() => {
    sessionStorage.setItem(seenKey, "1");
  }, [seenKey]);

  useEffect(() => {
    if (seconds === null) return undefined;
    if (seconds <= 0) {
      navigate("/payments");
      return undefined;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, navigate]);

  const goNow = () => navigate("/payments");

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Library card application</h1>
      <p className="mt-1 text-sm text-gray-500">Your librarian has reviewed your registration.</p>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="text-[11px] font-bold tracking-wide text-green-700">APPROVED BY LIBRARIAN</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Your registration form successfully approved.</h2>
          <p className="mt-2 text-sm text-gray-600">Your library card application is approved.</p>
        </div>

        <h3 className="mt-8 text-lg font-bold text-gray-900">Manage your fees in Payments</h3>
        <p className="mt-1 text-sm text-gray-500">
          Pay your library card fee, overdue fines, and other library charges in one place.
        </p>

        <button
          onClick={goNow}
          className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to Payments
        </button>
        {seconds !== null && (
          <p className="mt-3 text-xs text-gray-400">
            You’ll be redirected to Payments automatically in {Math.max(seconds, 0)} seconds.
          </p>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------ active card view
// The card itself is the reusable <LibraryCard /> component. Drop the
// university logo and the chief librarian's signature into src/assets
// (names below); if they're missing the card shows a clean fallback instead.

const firstAsset = (modules) => Object.values(modules)[0];
const LOGO_URL = firstAsset(
  import.meta.glob("../assets/bgc-logo.{png,jpg,jpeg,svg,webp}", { eager: true, query: "?url", import: "default" })
);
const SIGNATURE_URL = firstAsset(
  import.meta.glob("../assets/chief-librarian-signature.{png,jpg,jpeg,svg,webp}", {
    eager: true,
    query: "?url",
    import: "default",
  })
);

function ActiveCardView({ app }) {
  const student = {
    name: app.full_name,
    id_no: app.student_id,
    department: app.department,
    session: app.session,
    exp_date: app.valid_thru,
    photo: app.photo,
  };
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">My Library Card</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your card is active. You can now request books from the{" "}
        <Link to="/catalog" className="font-medium text-blue-600 hover:underline">Catalog</Link>.
      </p>
      <div className="mt-6">
        <LibraryCardView student={student} logoUrl={LOGO_URL} signatureUrl={SIGNATURE_URL} maxWidth={480} sideBySide />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- page

export default function LibraryCard() {
  const [info, setInfo] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [checking, setChecking] = useState(false);

  const load = async () => {
    setChecking(true);
    try {
      const res = await api.get("/library-card/");
      setInfo(res.data);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loadState === "loading") return <p className="p-8 text-sm text-gray-500">Loading...</p>;
  if (loadState === "error") {
    return <p className="p-8 text-sm text-red-600">Couldn't load your library card. Try refreshing.</p>;
  }

  if (info.is_active) return <ActiveCardView app={info.application} />;
  if (info.status === "approved") return <ApprovedView application={info.application} />;
  if (info.status === "pending") return <PendingView onRefresh={load} checking={checking} />;

  return (
    <>
      {info.status === "rejected" && (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Your application was not approved.</p>
          <p className="mt-1">Reason: {info.application.rejection_reason}</p>
          <p className="mt-1 text-red-700">Please correct the details below and apply again.</p>
        </div>
      )}
      <ApplicationForm previous={info.application} onSubmitted={load} />
    </>
  );
}
