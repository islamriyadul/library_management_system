import { useEffect, useRef, useState } from "react";
import { useAuth } from "../api/AuthContext";
import api from "../api/client";

// ---- Icons ----
const IconLock = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconShield = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 2 4 5v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V5l-8-3Z" />
  </svg>
);
const IconLink = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="8" cy="8" r="3" /><path d="M2 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
    <circle cx="17" cy="7" r="2.3" /><path d="M15.7 13.2c2.6.5 4.5 2.5 4.5 5.3" />
  </svg>
);
const IconBuilding = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <line x1="9" y1="7" x2="9" y2="7.01" /><line x1="15" y1="7" x2="15" y2="7.01" />
    <line x1="9" y1="11" x2="9" y2="11.01" /><line x1="15" y1="11" x2="15" y2="11.01" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);
const IconPencil = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

// Role-specific config — mirrors the backend's role-specific Profile fields exactly
const ROLE_CONFIG = {
  student: {
    cardTitle: "Student Profile",
    cardSubtitle: "Keep your academic profile current for borrowing, reservations, and library notices.",
    orgLineField: "department",
    fields: [
      { key: "student_id", label: "Student ID" },
      { key: "batch", label: "Batch" },
      { key: "department", label: "Department" },
    ],
  },
  librarian: {
    cardTitle: "Librarian Profile",
    cardSubtitle: "Maintain the staff information used for circulation, member support, and internal directories.",
    orgLineField: "library_unit",
    fields: [
      { key: "staff_id", label: "Staff ID" },
      { key: "employment_type", label: "Employment Type" },
      { key: "library_unit", label: "Library Unit" },
    ],
  },
  admin: {
    cardTitle: "System Administrator Profile",
    cardSubtitle: "Review the administrative identity shown in audit records, permissions, and system communications.",
    orgLineField: "office_location",
    fields: [
      { key: "employee_id", label: "Employee ID" },
      { key: "access_level", label: "Access Level" },
      { key: "office_location", label: "Office Location" },
    ],
  },
};

function formatLastUpdated(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `today at ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${time}`;
}

export default function Profile() {
  const { user, loading, refreshUser } = useAuth();
  const config = ROLE_CONFIG[user?.role] || ROLE_CONFIG.student;

  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [avatarDrag, setAvatarDrag] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const resetFormFromUser = () => {
    if (!user) return;
    const next = { first_name: user.first_name || "", last_name: user.last_name || "" };
    config.fields.forEach((f) => { next[f.key] = user[f.key] || ""; });
    setForm(next);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  useEffect(resetFormFromUser, [user, user?.role]);

  if (loading) return <div className="text-sm text-gray-500">Loading profile...</div>;
  if (!user) return <div className="text-sm text-gray-500">Not logged in.</div>;

  const setPhotoFromFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("That file isn't an image."); return; }
    setError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("first_name", form.first_name || "");
      payload.append("last_name", form.last_name || "");
      config.fields.forEach((f) => payload.append(f.key, form[f.key] || ""));
      if (photoFile) payload.append("profile_picture", photoFile);

      await api.patch("/auth/me/", payload);
      await refreshUser();
      setPhotoFile(null);
      setPhotoPreview(null);
      setSaved(true);
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Could not save changes."));
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuOpen(false);
    setError("");
    setRemovingPhoto(true);
    try {
      const payload = new FormData();
      payload.append("remove_profile_picture", "true");
      await api.patch("/auth/me/", payload);
      await refreshUser();
      // discard any unsaved local preview too, so a pending drag-and-drop
      // selection doesn't reappear after removing the saved photo
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not remove photo.");
    } finally {
      setRemovingPhoto(false);
    }
  };

  // Real completion % — first/last name + photo + this role's 3 fields
  const totalSlots = 2 + 1 + config.fields.length;
  const filledSlots =
    (form.first_name ? 1 : 0) +
    (form.last_name ? 1 : 0) +
    (photoPreview || user.profile_picture ? 1 : 0) +
    config.fields.filter((f) => form[f.key]).length;
  const completePct = Math.round((filledSlots / totalSlots) * 100);

  const currentPhoto = photoPreview || user.profile_picture;
  const orgLineValue = user[config.orgLineField];
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "librarian" ? "Librarian" : "Student";
  const lastUpdated = formatLastUpdated(user.updated_at);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your personal information and review account access.</p>
        </div>
        {lastUpdated && <p className="text-xs text-gray-400">Last updated {lastUpdated}</p>}
      </div>

      {/* Banner + identity card */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* overflow-hidden lives HERE, not on the outer card, so it only
            clips the decorative circles to the banner's own rounded-t-xl
            corners — it no longer clips the avatar's dropdown menu below. */}
        <div className="relative h-28 overflow-hidden rounded-t-xl bg-gradient-to-br from-blue-800 to-blue-950">
          <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 100" preserveAspectRatio="none">
            <circle cx="350" cy="10" r="60" fill="none" stroke="white" strokeWidth="1" />
            <circle cx="300" cy="80" r="40" fill="none" stroke="white" strokeWidth="1" />
            <circle cx="380" cy="60" r="25" fill="none" stroke="white" strokeWidth="1" />
          </svg>
        </div>

        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <div
            onDrop={(e) => { e.preventDefault(); setAvatarDrag(false); setPhotoFromFile(e.dataTransfer.files?.[0]); }}
            onDragOver={(e) => { e.preventDefault(); setAvatarDrag(true); }}
            onDragLeave={(e) => { e.preventDefault(); setAvatarDrag(false); }}
            className={`group relative -mt-12 h-24 w-24 shrink-0 rounded-full border-4 border-white bg-gray-100 shadow-md ${avatarDrag ? "ring-2 ring-blue-400" : ""}`}
          >
            {removingPhoto ? (
              <div className="flex h-full w-full items-center justify-center rounded-full text-xs text-gray-400">Removing...</div>
            ) : currentPhoto ? (
              <img src={currentPhoto} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full text-xs text-gray-400">No photo</div>
            )}

            {/* Hidden input lives outside the button so "Upload new photo"
                in the menu below can trigger it programmatically */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { setPhotoFromFile(e.target.files?.[0]); setPhotoMenuOpen(false); }}
            />

            <button
              type="button"
              title="Edit profile photo"
              onClick={() => setPhotoMenuOpen((open) => !open)}
              className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-blue-900 text-white shadow hover:bg-blue-800"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </button>

            {photoMenuOpen && (
              <>
                {/* Click-away backdrop — closes the menu without needing an
                    outside-click library */}
                <div className="fixed inset-0 z-10" onClick={() => setPhotoMenuOpen(false)} />
                <div className="absolute left-1/2 top-full z-20 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-md border border-gray-100 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setPhotoMenuOpen(false); fileInputRef.current?.click(); }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Upload new photo
                  </button>
                  {currentPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="block w-full border-t border-gray-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                user.is_active_account ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.is_active_account ? "bg-green-500" : "bg-red-500"}`} />
                {user.is_active_account ? "Active" : "Suspended"}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-blue-700">{roleLabel}</p>
            {orgLineValue && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                <IconBuilding className="h-3.5 w-3.5 text-gray-400" /> {orgLineValue}
              </p>
            )}
          </div>

          <div className="w-full pt-2 sm:w-40">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Profile complete</span>
              <span className="font-semibold text-gray-700">{completePct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${completePct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {error && <p className="mt-4 rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}
        {saved && <p className="mt-4 rounded-md bg-green-50 p-2 text-xs text-green-700">Saved.</p>}

        {/* Account Details — locked */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <IconShield className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Account Details</h3>
              <p className="text-xs text-gray-500">These system-managed values are fixed and cannot be edited.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Username", value: user.username },
              { label: "Email", value: user.email },
              { label: "Role", value: roleLabel },
            ].map((f) => (
              <div key={f.label}>
                <label className="flex items-center gap-1 text-xs font-medium text-gray-500">
                  {f.label} <IconLock className="h-3 w-3 text-gray-300" />
                </label>
                <input
                  disabled
                  value={f.value || "—"}
                  className="mt-1 w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Role-specific editable fields */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <IconLink className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{config.cardTitle}</h3>
              <p className="text-xs text-gray-500">{config.cardSubtitle}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-500">First Name</label>
              <input
                value={form.first_name || ""}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Last Name</label>
              <input
                value={form.last_name || ""}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            {/* fields[0] and fields[1] paired, fields[2] full width — matches
                the layout for all three roles (e.g. Student ID + Batch, then
                Department full-width) */}
            {config.fields.slice(0, 2).map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-500">{f.label}</label>
                <input
                  value={form[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            ))}
            {config.fields[2] && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-500">{config.fields[2].label}</label>
                <input
                  value={form[config.fields[2].key] || ""}
                  onChange={(e) => setForm({ ...form, [config.fields[2].key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={resetFormFromUser} className="text-sm font-medium text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-md bg-blue-900 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
