import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

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

const MOCK_LOANS = [
  {
    id: 1,
    title: "Introduction to Algorithms (3rd Ed.)",
    author: "Thomas H. Cormen, Charles E. Leiserson",
    isbn: "978-0262033848",
    callNumber: "QA76.6 .C662 2009",
    dateIssued: "Nov 10, 2024",
    dueDate: "Nov 24, 2024",
    overdue: false,
  },
  {
    id: 2,
    title: "Artificial Intelligence: A Modern Approach",
    author: "Stuart Russell, Peter Norvig",
    isbn: "978-0136042594",
    callNumber: "Q335 .R87 2010",
    dateIssued: "Nov 12, 2024",
    dueDate: "Nov 26, 2024",
    overdue: false,
  },
  {
    id: 3,
    title: "Database System Concepts (7th Ed.)",
    author: "Abraham Silberschatz, Henry F. Korth",
    isbn: "978-0078022159",
    callNumber: "QA76.9.D3 S56",
    dateIssued: "Oct 28, 2024",
    dueDate: "Nov 11, 2024",
    overdue: true,
  },
  {
    id: 4,
    title: "Computer Networking: A Top-Down Approach",
    author: "James F. Kurose, Keith Ross",
    isbn: "978-0134008141",
    callNumber: "TK5105.5 .K87 2017",
    dateIssued: "Nov 14, 2024",
    dueDate: "Nov 28, 2024",
    overdue: false,
  },
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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-gray-100 bg-white px-4 py-6">
        <div>
          <div className="mb-8 flex items-center gap-3 px-2">
            <button className="text-gray-400 hover:text-gray-600 lg:hidden">
              <IconMenu className="h-5 w-5" />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <IconBook className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-gray-900">Central Library</p>
              <p className="text-[11px] font-medium tracking-wide text-gray-400">STUDENT PORTAL</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <SidebarLink
                key={item.key}
                item={item}
                active={location.pathname === item.path}
              />
            ))}
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-3 rounded-md border-l-4 border-transparent px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <IconLogout className="h-5 w-5 text-gray-400" />
              Log Out
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
            {/* Replace with <img src={avatarUrl} /> once wired to real user data */}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {user?.username || "..."}
            </p>
            <p className="truncate text-xs text-gray-400">
              {user?.department || "Student"}
            </p>
          </div>
        </div>
      </aside>

      {/* Main canvas */}
      <main className="flex-1 px-8 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Hub Dashboard</h1>
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
            value="2"
            footnote="No overdue volumes currently"
          />
          <MetricCard
            title="Days Till Next Due Date"
            icon={IconClock}
            value="Nov 24"
            badge="4 Days Left"
            badgeTone="amber"
            footnote="Renew before due date to avoid fines"
          />
          <MetricCard
            title="My Total Fine Balance"
            icon={IconBookmark}
            value="0.00 BDT"
            badge="No Pending Dues"
            badgeTone="green"
            footnote="All dues cleared"
          />
        </div>

        {/* Active loans table */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">My Active Personal Loans</h2>
          <p className="mt-1 text-sm text-gray-500">
            List of currently issued literature and textbook volumes under your account
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Book Title &amp; Author</th>
                  <th className="pb-3 pr-4 font-medium">Shelf Call Number</th>
                  <th className="pb-3 pr-4 font-medium">Date Issued</th>
                  <th className="pb-3 pr-4 font-medium">Due Date</th>
                  <th className="pb-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_LOANS.map((loan, i) => (
                  <tr
                    key={loan.id}
                    className={i !== MOCK_LOANS.length - 1 ? "border-b border-gray-50" : ""}
                  >
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-gray-900">{loan.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {loan.author} &bull; ISBN {loan.isbn}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-gray-600">{loan.callNumber}</td>
                    <td className="py-4 pr-4 text-gray-600">{loan.dateIssued}</td>
                    <td className={`py-4 pr-4 font-medium ${loan.overdue ? "text-red-600" : "text-gray-700"}`}>
                      {loan.dueDate}
                    </td>
                    <td className="py-4 text-right">
                      {loan.overdue ? (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium text-gray-300"
                        >
                          Extension Locked
                        </button>
                      ) : (
                        <button className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50">
                          Request Extension
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
