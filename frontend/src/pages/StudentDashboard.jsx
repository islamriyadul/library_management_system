import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// ---- Inline icon components (no external icon package) ----
const IconMenu = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const IconGrid = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconCatalog = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const IconBook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...props}>
    <path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13Z" />
  </svg>
);

const IconClock = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const IconBookmark = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...props}>
    <path d="M6 3h12v18l-6-4-6 4V3Z" />
  </svg>
);

const IconCircle = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const IconUser = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.58-7 8-7s8 3 8 7" />
  </svg>
);

const IconLogout = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconSearch = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ---- Mock data (placeholder only — not wired to the backend yet) ----
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: IconGrid, path: "/" },
  { key: "catalog", label: "Catalog", icon: IconCatalog, path: "/catalog" },
  { key: "loans", label: "My Loans", icon: IconBook, path: "/my-loans" },
  { key: "fines", label: "My Fines", icon: IconCircle, path: "/my-fines" },
  { key: "profile", label: "Profile", icon: IconUser, path: "/profile" },
];



function SidebarLink({ item, active }) {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-l-4 border-blue-600 bg-blue-50 pl-2 text-blue-700"
          : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-gray-400"}`} />
      {item.label}
    </Link>
  );
}

function MetricCard({ title, icon: Icon, value, badge, badgeTone, footnote }) {
  const toneClasses =
    badgeTone === "amber"
      ? "bg-amber-100 text-amber-700"
      : badgeTone === "green"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {badge && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-400">{footnote}</p>
    </div>
  );
}

export default function StudentDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loans, setLoans] = useState(null); // null = loading
  const [books, setBooks] = useState({}); // id -> book, for author/subject lookup

  useEffect(() => {
    api.get("/loans/mine/").then((res) => setLoans(res.data)).catch(() => setLoans([]));
    api.get("/books/").then((res) => {
      const map = {};
      res.data.forEach((b) => { map[b.id] = b; });
      setBooks(map);
    }).catch(() => setBooks({}));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const activeLoans = loans ? loans.filter((l) => !l.is_returned) : [];
  const overdueActive = activeLoans.filter((l) => new Date(l.due_date) < new Date());
  // current_fine is the live owed amount — correct for both an active
  // overdue loan (grows daily) and a returned one (locked in). fine_amount
  // alone would understate this, since it stays 0 until a book is returned.
  const totalFines = loans
    ? loans.reduce((sum, l) => sum + Number(l.current_fine || 0), 0)
    : 0;

  // Nearest upcoming due date among active loans (for the "Days Till Next
  // Due Date" card)
  const nextDue = activeLoans.length
    ? activeLoans.reduce((soonest, l) =>
        new Date(l.due_date) < new Date(soonest.due_date) ? l : soonest
      )
    : null;
  const daysLeft = nextDue
    ? Math.ceil((new Date(nextDue.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const handleExtensionClick = () => {
    alert("Renewals/extensions aren't a built feature yet — there's no backend endpoint for this.");
  };

  return (
    <>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Students Journey</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {user?.username || "student"}. Monitor your outstanding loans and explore the catalog.
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
            <IconClock className="h-4 w-4 text-gray-400" />
            Semester: Fall 2026
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-400" />
          <input
            type="text"
            placeholder="Search 124,000+ books by Title, Author, Subject, or ISBN..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <MetricCard
            title="My Checked-out Books"
            icon={IconBook}
            value={loans === null ? "—" : activeLoans.length}
            footnote={
              loans === null
                ? "Loading..."
                : overdueActive.length > 0
                ? `${overdueActive.length} overdue volume${overdueActive.length > 1 ? "s" : ""}`
                : "No overdue volumes currently"
            }
          />
          <MetricCard
            title="Days Till Next Due Date"
            icon={IconClock}
            value={nextDue ? formatDate(nextDue.due_date) : "—"}
            badge={nextDue ? (daysLeft >= 0 ? `${daysLeft} Days Left` : `${Math.abs(daysLeft)} Days Overdue`) : "No active loans"}
            badgeTone={nextDue ? (daysLeft >= 0 ? "amber" : "red") : "green"}
            footnote="Renew before due date to avoid fines"
          />
          <MetricCard
            title="My Total Fine Balance"
            icon={IconBookmark}
            value={`${totalFines.toFixed(2)} BDT`}
            badge={totalFines > 0 ? "Payment Due" : "No Pending Dues"}
            badgeTone={totalFines > 0 ? "amber" : "green"}
            footnote={totalFines > 0 ? "Includes fines still accruing on overdue books" : "All dues cleared"}
          />
        </div>

        {/* Active loans table */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">My Active Personal Loans</h2>
          <p className="mt-1 text-sm text-gray-500">
            List of currently issued literature and textbook volumes under your account
          </p>

          <div className="mt-5 overflow-x-auto">
            {loans === null && <p className="py-4 text-sm text-gray-500">Loading...</p>}
            {loans !== null && activeLoans.length === 0 && (
              <p className="py-4 text-sm text-gray-400">No active loans right now.</p>
            )}
            {activeLoans.length > 0 && (
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-3 pr-4 font-medium">Book Title &amp; Author</th>
                    <th className="pb-3 pr-4 font-medium">Subject</th>
                    <th className="pb-3 pr-4 font-medium">Date Issued</th>
                    <th className="pb-3 pr-4 font-medium">Due Date</th>
                    <th className="pb-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans.map((loan, i) => {
                    const book = books[loan.book];
                    const overdue = new Date(loan.due_date) < new Date();
                    return (
                      <tr
                        key={loan.id}
                        className={i !== activeLoans.length - 1 ? "border-b border-gray-50" : ""}
                      >
                        <td className="py-4 pr-4">
                          <p className="font-semibold text-gray-900">{loan.book_title}</p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {book ? `${book.author} • ISBN ${book.isbn}` : "—"}
                          </p>
                        </td>
                        <td className="py-4 pr-4 text-gray-600">{book?.subject || "—"}</td>
                        <td className="py-4 pr-4 text-gray-600">{formatDate(loan.issue_date)}</td>
                        <td className={`py-4 pr-4 font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>
                          {formatDate(loan.due_date)}
                        </td>
                        <td className="py-4 text-right">
                          {overdue ? (
                            <button
                              disabled
                              className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium text-gray-300"
                            >
                              Extension Locked
                            </button>
                          ) : (
                            <button
                              onClick={handleExtensionClick}
                              className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Request Extension
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
    </>
  );
}
