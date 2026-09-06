import { useAuth } from "../api/AuthContext";

// NOTE: no Figma design exists for this page yet — plain functional layout
// for now. Restyle once the Profile frame is designed.
export default function Profile() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading profile...</div>;
  }

  if (!user) {
    return <div className="p-8 text-sm text-gray-500">Not logged in.</div>;
  }

  const rows = [
    { label: "Username", value: user.username },
    { label: "Email", value: user.email || "—" },
    { label: "Role", value: user.role },
    { label: "Student ID", value: user.student_id || "—" },
    { label: "Department", value: user.department || "—" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your account details. This is view-only for now — editing isn't supported yet.
      </p>

      <div className="mt-6 max-w-lg rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <dl className="divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <dt className="text-sm text-gray-500">{row.label}</dt>
              <dd className="text-sm font-medium capitalize text-gray-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
