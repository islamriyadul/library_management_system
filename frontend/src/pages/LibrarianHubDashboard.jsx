import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import api from "../api/client";

// ---- Inline icons ----
const IconGrid = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconCatalog = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" /><line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);
const IconManage = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
);
const IconIssue = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" />
  </svg>
);
const IconBook = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...p}>
    <path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13Z" />
  </svg>
);
const IconCircle = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="9" /></svg>
);
const IconUser = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.58-7 8-7s8 3 8 7" />
  </svg>
);
const IconLogout = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconClock = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const IconPeople = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    <circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.9.6 5 2.7 5 5.8" />
  </svg>
);

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: IconGrid, path: "/dashboard" },
  { key: "catalog", label: "Catalog", icon: IconCatalog, path: "/catalog" },
  { key: "manage", label: "Add / Manage Books", icon: IconManage, path: "/manage-books" },
  { key: "issue", label: "Issue / Return Books", icon: IconIssue, path: "/issue-return" },
  { key: "loans", label: "All Loans", icon: IconBook, path: "/all-loans" },
  { key: "fines", label: "Fines", icon: IconCircle, path: "/librarian-fines" },
  { key: "profile", label: "Profile", icon: IconUser, path: "/profile" },
];

// Static demo data for the "Daily Book Traffic" chart — there is no analytics
// endpoint in the backend yet, so this stays hardcoded until that's built.
const TRAFFIC = [
  { time: "08:00", value: 30 },
  { time: "10:00", value: 45 },
  { time: "12:00", value: 55 },
  { time: "14:00", value: 90, peak: true },
  { time: "16:00", value: 50 },
  { time: "18:00", value: 35 },
  { time: "20:00", value: 20 },
];

// Purpose options for logging a walk-in (matches the Figma design's examples)
const PURPOSE_OPTIONS = ["Textbook Issue", "Rare MS Access", "General Loan", "Return Deposit"];

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hr ago`;
}

function SidebarLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-l-4 border-blue-900 bg-blue-50 pl-2 text-blue-900"
          : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-blue-900" : "text-gray-400"}`} />
      {item.label}
    </Link>
  );
}

function MetricCard({ title, value, footnote, icon: Icon, iconTone }) {
  const toneClasses = {
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-500",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
  }[iconTone];

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className={`rounded-lg p-2 ${toneClasses}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1.5 text-xs text-gray-400">{footnote}</p>
    </div>
  );
}

export default function LibrarianHubDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loans, setLoans] = useState(null); // null = loading
  const [queue, setQueue] = useState(null); // null = loading
  const [walkIn, setWalkIn] = useState({ username: "", purpose: PURPOSE_OPTIONS[0] });
  const [queueError, setQueueError] = useState("");

  const loadQueue = () => {
    api
      .get("/verification/")
      .then((res) => setQueue(res.data))
      .catch(() => setQueue([]));
  };

  useEffect(() => {
    api
      .get("/loans/all/")
      .then((res) => setLoans(res.data))
      .catch(() => setLoans([]));
    loadQueue();
  }, []);

  const handleLogWalkIn = async (e) => {
    e.preventDefault();
    setQueueError("");
    try {
      await api.post("/verification/create/", walkIn);
      setWalkIn({ username: "", purpose: PURPOSE_OPTIONS[0] });
      loadQueue();
    } catch (err) {
      setQueueError(err.response?.data?.detail || "Could not log this student.");
    }
  };

  const handleResolve = async (id, action) => {
    try {
      await api.post(`/verification/${id}/resolve/`, { action });
      loadQueue();
    } catch {
      setQueueError("Could not resolve this request.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ---- Real numbers computed from actual loan data ----
  const activeLoans = loans ? loans.filter((l) => !l.is_returned) : [];
  const overdueToday = loans
    ? activeLoans.filter((l) => new Date(l.due_date) < new Date())
    : [];
  const totalActiveTransactions = loans ? activeLoans.length : "—";
  const booksOverdueCount = loans ? overdueToday.length : "—";

  return (
    <>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Librarian Desk Operations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Circulation desk monitor and student loan tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              <IconClock className="h-4 w-4 text-gray-400" />
              Term: Fall 2026
            </span>
            {/* Routes to the real Add/Manage Books page — registering a new
                physical copy is just adding/editing a Book record */}
            <Link
              to="/manage-books"
              className="flex items-center gap-1.5 rounded-full bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <IconPlus className="h-4 w-4" />
              Register Volume
            </Link>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pending Issue Requests"
            value={queue === null ? "—" : queue.length}
            footnote="Students waiting to be cleared"
            icon={IconPlus}
            iconTone="amber"
          />
          <MetricCard
            title="Books Overdue Today"
            value={booksOverdueCount}
            footnote="Live count from active loans"
            icon={IconClock}
            iconTone="red"
          />
          <MetricCard
            title="Returns Processing Queue"
            value="—"
            footnote="No queue workflow exists yet"
            icon={IconBook}
            iconTone="blue"
          />
          <MetricCard
            title="Total Active Transactions"
            value={totalActiveTransactions}
            footnote="Loans currently checked out"
            icon={IconPeople}
            iconTone="green"
          />
        </div>

        {/* Live Circulation Input Deck — logs a real student walk-in into
            the verification queue below. No barcode scanner hardware
            exists, so this is a manual username + purpose form instead. */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Live Circulation Input Deck</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Log a student arriving at the desk — it'll appear in the queue below to clear.
          </p>

          {queueError && (
            <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-600">{queueError}</p>
          )}

          <form onSubmit={handleLogWalkIn} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-400" />
              <input
                required
                placeholder="Student username..."
                value={walkIn.username}
                onChange={(e) => setWalkIn({ ...walkIn, username: e.target.value })}
                className="w-full rounded-xl border border-gray-200 py-3.5 pl-12 pr-4 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={walkIn.purpose}
              onChange={(e) => setWalkIn({ ...walkIn, purpose: e.target.value })}
              className="rounded-xl border border-gray-200 px-4 py-3.5 text-sm text-gray-700"
            >
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <IconPlus className="h-4 w-4" />
              Log Arrival
            </button>
          </form>
        </div>

        {/* Bottom columns */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Verification logs — now real data from the backend queue */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Incoming Student Verification Logs</h2>
            <p className="mt-1 text-sm text-gray-500">Students waiting at counter. Verify ID credentials before approving checkout.</p>

            {queue === null && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
            {queue && queue.length === 0 && (
              <p className="mt-4 text-sm text-gray-400">No one waiting right now.</p>
            )}
            {queue && queue.length > 0 && (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-2 font-medium">Student</th>
                    <th className="pb-2 pr-2 font-medium">Purpose</th>
                    <th className="pb-2 pr-2 font-medium">Arrived</th>
                    <th className="pb-2 pr-2 font-medium">Clearance</th>
                    <th className="pb-2 text-right font-medium">Verify</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50">
                      <td className="py-3 pr-2 font-medium text-gray-900">{row.student_username}</td>
                      <td className="py-3 pr-2 text-gray-600">{row.purpose}</td>
                      <td className="py-3 pr-2 text-gray-400">{timeAgo(row.created_at)}</td>
                      <td className="py-3 pr-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.clearance === "overdue"
                              ? "bg-red-50 text-red-600"
                              : "bg-green-50 text-green-600"
                          }`}
                        >
                          {row.clearance === "overdue" ? "Overdue Fine" : "Clear"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleResolve(row.id, "approve")}
                            title="Approve"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleResolve(row.id, "reject")}
                            title="Reject"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Daily traffic chart — static demo data, no analytics endpoint yet */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Daily Book Traffic</h2>
            <p className="mt-1 text-sm text-gray-500">Demo data — no analytics endpoint exists yet.</p>

            <div className="mt-6 flex h-40 items-end gap-3">
              {TRAFFIC.map((bar) => (
                <div key={bar.time} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className={`w-full rounded-t-md ${bar.peak ? "bg-[#0B2545]" : "bg-gray-200"}`}
                    style={{ height: `${bar.value}%` }}
                  />
                  <span className="text-[11px] text-gray-400">{bar.time}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0B2545]" /> Peak Hours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" /> Standard Traffic
              </span>
            </div>
          </div>
        </div>
    </>
  );
}
