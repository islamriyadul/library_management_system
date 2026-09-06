import { useAuth } from "../api/AuthContext";

// There is no "system settings" concept in the backend at all (no config
// model, no theme/session/backup settings anywhere). This page is an honest
// placeholder rather than a fake settings form — real settings can be
// designed here once you know what should actually be configurable.
export default function SystemSettings() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-8">
      <div className="max-w-md rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-400">System Settings</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">Not built yet</h1>
        <p className="mt-2 text-sm text-gray-500">
          There's no settings/config feature in the backend yet, {user?.username}. Let's design what
          should actually be configurable here before building it.
        </p>
      </div>
    </div>
  );
}
