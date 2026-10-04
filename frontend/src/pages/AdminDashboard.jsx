import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import api from "../api/client";

// ---- Inline icons ----
const IconGrid = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
const IconCatalog = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="5" y="3" width="14" height="18" rx="1.5" /><line x1="9" y1="3" x2="9" y2="21" /></svg>);
const IconManage = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="4" y1="12" x2="20" y2="12" /></svg>);
const IconIssue = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" /></svg>);
const IconBook = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...p}><path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13Z" /></svg>);
const IconCircle = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><circle cx="12" cy="12" r="9" /></svg>);
const IconUser = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.58-7 8-7s8 3 8 7" /></svg>);
const IconPeople = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.9.6 5 2.7 5 5.8" /></svg>);
const IconLogout = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
const IconSearch = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
const IconPlus = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
const IconClock = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
const IconGear = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>);
const IconBar = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="6" y1="20" x2="6" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="18" y1="20" x2="18" y2="14" /></svg>);
const IconAlert = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: IconGrid, path: "/admin-dashboard" },
  { key: "catalog", label: "Catalog", icon: IconCatalog, path: "/catalog" },
  { key: "manage", label: "Add / Manage Books", icon: IconManage, path: "/manage-books" },
  { key: "issue", label: "Issue / Return Books", icon: IconIssue, path: "/issue-return" },
  { key: "loans", label: "All Loans", icon: IconBook, path: "/all-loans" },
  { key: "fines", label: "Fines", icon: IconCircle, path: "/librarian-fines" },
  { key: "staff", label: "Manage Staff", icon: IconPeople, path: "/manage-staff" },
  { key: "reports", label: "Reports", icon: IconBar, path: "/reports" },
  { key: "settings", label: "System Settings", icon: IconGear, path: "/system-settings" },
  { key: "profile", label: "Profile", icon: IconUser, path: "/profile" },
];

// Demo-only activity feed — no audit-log model exists in the backend yet.
const ACTIVITY_LOG = [
  { id: 1, title: "Added new staff member", detail: "A new account was registered", time: "10 mins ago" },
  { id: 2, title: "Database backup completed", detail: "Routine backup finished", time: "45 mins ago" },
  { id: 3, title: "System configuration changed", detail: "Settings were updated", time: "2 hours ago" },
];

function SidebarLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-l-4 border-blue-900 bg-blue-50 pl-2 text-blue-900" : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-blue-900" : "text-gray-400"}`} />
      {item.label}
    </Link>
  );
}

function MetricCard({ title, value, badge, badgeTone, icon: Icon }) {
  const toneClasses = { blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700" }[badgeTone];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}>{badge}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [staff, setStaff] = useState(null); // null = loading
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/staff/").then((res) => setStaff(res.data)).catch(() => setStaff([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleToggleActive = async (id) => {
    await api.post(`/staff/${id}/toggle-active/`);
    api.get("/staff/").then((res) => setStaff(res.data));
  };

  const filteredStaff = (staff || []).filter(
    (s) => s.username.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
            <p className="mt-1 text-sm text-gray-500">Manage staff accounts and system-wide library operations</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              <IconClock className="h-4 w-4 text-gray-400" />
              Term: Fall 2026
            </span>
            <Link to="/manage-staff" className="flex items-center gap-1.5 rounded-full bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              <IconPlus className="h-4 w-4" />
              Add Staff Member
            </Link>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Staff Accounts" value={staff ? staff.length : "—"} badge="Live count" badgeTone="blue" icon={IconPeople} />
          <MetricCard title="Active Librarians Online" value="—" badge="No presence tracking" badgeTone="green" icon={IconClock} />
          <MetricCard title="Pending Role Requests" value="—" badge="No such workflow yet" badgeTone="amber" icon={IconAlert} />
          <MetricCard title="System Uptime" value="—" badge="No monitoring set up" badgeTone="green" icon={IconGear} />
        </div>

        {/* Staff Directory + Activity Log */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Staff Directory</h2>
                <p className="mt-1 text-sm text-gray-500">Registered librarians and admins</p>
              </div>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="w-48 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            {staff === null && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
            {staff && (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-2 font-medium">Name &amp; Email</th>
                    <th className="pb-2 pr-2 font-medium">Role</th>
                    <th className="pb-2 pr-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-3 pr-2">
                        <p className="font-medium text-gray-900">{s.username}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="py-3 pr-2 capitalize text-gray-600">{s.role}</td>
                      <td className="py-3 pr-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active_account ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                          {s.is_active_account ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => handleToggleActive(s.id)} className="text-sm font-medium text-blue-700 hover:underline">
                          {s.is_active_account ? "Suspend" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Activity log — demo data, no audit-log model exists */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">System Activity Log</h2>
            <p className="mt-1 text-sm text-gray-500">Demo data — no audit-log feature exists yet.</p>
            <div className="relative mt-5 space-y-6 pl-6">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
              {ACTIVITY_LOG.map((item) => (
                <div key={item.id} className="relative">
                  <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.detail}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-gray-400">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Role & Permission Matrix — demo only. Reflects the ACTUAL 3-role
            system (Student/Librarian/Admin) and the real permission rules
            in permissions.py, not the 4 roles shown in the Figma mock. */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">Role &amp; Permission Matrix</h2>
          <p className="mt-1 text-sm text-gray-500">
            Reflects your actual 3-role system — permissions are fixed in code, not editable here yet.
          </p>
          <table className="mt-4 w-full text-center text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 text-left font-medium">Role</th>
                <th className="pb-2 font-medium">Manage Staff</th>
                <th className="pb-2 font-medium">Edit Catalog</th>
                <th className="pb-2 font-medium">Issue Books</th>
                <th className="pb-2 font-medium">View All Loans</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: "Admin", manage: true, catalog: true, issue: true, loans: true },
                { role: "Librarian", manage: false, catalog: true, issue: true, loans: true },
                { role: "Student", manage: false, catalog: false, issue: false, loans: false },
              ].map((r) => (
                <tr key={r.role} className="border-b border-gray-50">
                  <td className="py-3 text-left font-medium text-gray-900">{r.role}</td>
                  {[r.manage, r.catalog, r.issue, r.loans].map((val, i) => (
                    <td key={i} className="py-3">
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full ${val ? "bg-green-50 text-green-600" : "text-gray-300"}`}>
                        {val ? "✓" : "–"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </>
  );
}
