import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

// ---- Inline icons (shared across the whole app) ----
const IconGrid = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
const IconCatalog = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="5" y="3" width="14" height="18" rx="1.5" /><line x1="9" y1="3" x2="9" y2="21" /></svg>);
const IconManage = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="4" y1="12" x2="20" y2="12" /></svg>);
const IconIssue = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" /></svg>);
const IconBook = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...p}><path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13Z" /></svg>);
const IconCircle = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="9" /></svg>);
const IconUser = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.58-7 8-7s8 3 8 7" /></svg>);
const IconPeople = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.9.6 5 2.7 5 5.8" /></svg>);
const IconBar = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="6" y1="20" x2="6" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="18" y1="20" x2="18" y2="14" /></svg>);
const IconGear = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>);
const IconInbox = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></svg>);
const IconLogout = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);

const NAV_BY_ROLE = {
  student: [
    { label: "Dashboard", icon: IconGrid, path: "/" },
    { label: "Catalog", icon: IconCatalog, path: "/catalog" },
    { label: "My Loans", icon: IconBook, path: "/my-loans" },
    { label: "My Fines", icon: IconCircle, path: "/my-fines" },
  ],
  librarian: [
    { label: "Dashboard", icon: IconGrid, path: "/dashboard" },
    { label: "Catalog", icon: IconCatalog, path: "/catalog" },
    { label: "Add / Manage Books", icon: IconManage, path: "/manage-books" },
    { label: "Issue / Return Books", icon: IconIssue, path: "/issue-return" },
    { label: "All Loans", icon: IconBook, path: "/all-loans" },
    { label: "Fines", icon: IconCircle, path: "/librarian-fines" },
    { label: "Book Requests", icon: IconInbox, path: "/book-requests" },
  ],
  admin: [
    { label: "Dashboard", icon: IconGrid, path: "/admin-dashboard" },
    { label: "Catalog", icon: IconCatalog, path: "/catalog" },
    { label: "Add / Manage Books", icon: IconManage, path: "/manage-books" },
    { label: "Issue / Return Books", icon: IconIssue, path: "/issue-return" },
    { label: "All Loans", icon: IconBook, path: "/all-loans" },
    { label: "Fines", icon: IconCircle, path: "/librarian-fines" },
    { label: "Book Requests", icon: IconInbox, path: "/book-requests" },
    { label: "Manage Staff", icon: IconPeople, path: "/manage-staff" },
    { label: "Reports", icon: IconBar, path: "/reports" },
    { label: "System Settings", icon: IconGear, path: "/system-settings" },
  ],
};

const PORTAL_LABEL = {
  student: "STUDENT PORTAL",
  librarian: "LIBRARIAN PORTAL",
  admin: "SYSTEM ADMIN",
};

// Each role keeps its ORIGINAL accent color exactly as it was in its own
// Figma-matched dashboard (Student = blue-600, Librarian/Admin = blue-900).
// Written as full literal class strings (not built with template
// interpolation) so Tailwind's build correctly includes every one of them.
const ACCENT = {
  student: {
    logoBg: "bg-blue-600",
    activeBorder: "border-blue-600",
    activeText: "text-blue-700",
    activeIcon: "text-blue-600",
  },
  librarian: {
    logoBg: "bg-blue-900",
    activeBorder: "border-blue-900",
    activeText: "text-blue-900",
    activeIcon: "text-blue-900",
  },
  admin: {
    logoBg: "bg-blue-900",
    activeBorder: "border-blue-900",
    activeText: "text-blue-900",
    activeIcon: "text-blue-900",
  },
};

function SidebarLink({ item, active, accent }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? `border-l-4 ${accent.activeBorder} bg-blue-50 pl-2 ${accent.activeText}`
          : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? accent.activeIcon : "text-gray-400"}`} />
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  // Active-link detection: read the current URL path and compare it against
  // each nav item's path. Whichever matches gets the highlighted state.
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const role = user?.role || "student";
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.student;
  const accent = ACCENT[role] || ACCENT.student;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-gray-100 bg-white px-4 py-6">
      <div>
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${accent.logoBg}`}>
            <IconBook className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-gray-900">Central Library</p>
            <p className="text-[11px] font-medium tracking-wide text-gray-400">{PORTAL_LABEL[role]}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              active={location.pathname === item.path}
              accent={accent}
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

      <Link
        to="/profile"
        className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
          location.pathname === "/profile"
            ? `${accent.activeBorder} bg-blue-50`
            : "border-gray-100 hover:bg-gray-50"
        }`}
      >
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {user?.profile_picture && (
            <img src={user.profile_picture} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{user?.username || "..."}</p>
          <p className="truncate text-xs capitalize text-gray-400">{user?.role || "..."}</p>
        </div>
      </Link>
    </aside>
  );
}
