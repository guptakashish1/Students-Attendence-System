import React, { useState, useEffect } from "react";
import {
  listenRegisteredStudents,
  getSchoolGeoSettings,
  saveSchoolGeoSettings,
  markAttendance,
  sendTelegramMessage,
  getTodayDate,
} from "../../firebase";

// ─── Haversine distance (metres) between two lat/lng coords ───────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6_371_000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Compass bearing label ────────────────────────────────────────────────
function bearingLabel(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(brg / 45) % 8];
}

const GeoAttendance = ({ userEmail, userRole }) => {
  const [students,     setStudents]    = useState([]);
  const [geoSettings,  setGeoSettings] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance,     setDistance]    = useState(null);
  const [locError,     setLocError]    = useState("");
  const [fetchingLoc,  setFetchingLoc] = useState(false);
  const [selectedRoll, setSelectedRoll] = useState("");
  const [marking,      setMarking]     = useState(false);
  const [marked,       setMarked]      = useState({});
  const [settingMode,  setSettingMode] = useState(false);
  const [geoForm,      setGeoForm]     = useState({ lat: "", lng: "", radius: "300" });
  const [saveMsg,      setSaveMsg]     = useState("");

  useEffect(() => {
    const unsub = listenRegisteredStudents((allStudents) => {
      // Filter for students - only show their own record
      if (userRole === "student" && userEmail) {
        const myStudents = allStudents.filter(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setStudents(myStudents);
        // Auto-select if only one student
        if (myStudents.length === 1) {
          setSelectedRoll(myStudents[0].rollNumber);
        }
      } else {
        setStudents(allStudents);
      }
    });
    getSchoolGeoSettings().then((s) => {
      if (s) setGeoSettings(s);
      else if (userRole !== "student") setSettingMode(true); // no settings yet, only admin can set
    });
    return () => unsub();
  }, [userEmail, userRole]);

  // ── Get user location ─────────────────────────────────────────────────
  function fetchLocation() {
    if (!navigator.geolocation) { setLocError("Geolocation is not supported by your browser."); return; }
    setFetchingLoc(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setFetchingLoc(false);
        if (geoSettings) {
          const d = haversine(geoSettings.lat, geoSettings.lng, latitude, longitude);
          setDistance(Math.round(d));
        }
      },
      (err) => {
        setLocError("Location error: " + err.message);
        setFetchingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const withinRadius = geoSettings && distance !== null && distance <= geoSettings.radiusMeters;

  // ── Mark attendance ───────────────────────────────────────────────────
  async function handleGeoAttend() {
    if (!selectedRoll || !withinRadius) return;
    setMarking(true);
    const student = students.find((s) => s.rollNumber === selectedRoll);
    if (!student) { setMarking(false); return; }

    const today = getTodayDate();
    await markAttendance(student, today, "IN");
    setMarked((p) => ({ ...p, [selectedRoll]: true }));

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (student.telegramChatId) {
      await sendTelegramMessage(
        student.telegramChatId,
        `📍 *Geo-location Attendance Confirmed*\n\n` +
        `Hello *${student.name}*!\n\n` +
        `✅ Your attendance was verified via *location* at *${time}* on ${today}.\n` +
        `📏 Distance from school: *${distance} m* (within ${geoSettings.radiusMeters} m radius)\n\n` +
        `If this wasn't you, contact the admin immediately.`
      );
    }
    setMarking(false);
  }

  // ── Save school geo settings ──────────────────────────────────────────
  async function handleSaveGeo(e) {
    e.preventDefault();
    setSaveMsg("");
    if (!geoForm.lat || !geoForm.lng) { setSaveMsg("Latitude and Longitude are required."); return; }
    await saveSchoolGeoSettings(geoForm.lat, geoForm.lng, geoForm.radius);
    const updated = await getSchoolGeoSettings();
    setGeoSettings(updated);
    setSettingMode(false);
    setSaveMsg("✅ School location saved!");
  }

  // Use current browser location to auto-fill school coords
  function useMyLocationForSchool() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGeoForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    });
  }

  // ── Distance ring colour ──────────────────────────────────────────────
  const ringColor = !distance           ? "#9ca3af"
                  : withinRadius        ? "#22c55e"
                  :                       "#ef4444";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">
          📍 {userRole === "student" ? "My Geo-location Attendance" : "Geo-location Attendance"}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {userRole === "student"
            ? "Mark your attendance when you're within the school radius."
            : "Students can mark attendance only when physically within the school radius."}
        </p>
      </div>

      {/* School geo settings */}
      {userRole !== "student" && (
        <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800">🏫 School Location</h3>
          <button onClick={() => setSettingMode((v) => !v)}
            className="text-xs text-purple-600 underline">
            {settingMode ? "Cancel" : "Change"}
          </button>
        </div>

        {settingMode ? (
          <form onSubmit={handleSaveGeo} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Latitude</label>
                <input type="number" step="any" value={geoForm.lat}
                  onChange={(e) => setGeoForm((f) => ({ ...f, lat: e.target.value }))}
                  className="w-full border p-2 rounded text-sm" placeholder="e.g. 28.6139" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Longitude</label>
                <input type="number" step="any" value={geoForm.lng}
                  onChange={(e) => setGeoForm((f) => ({ ...f, lng: e.target.value }))}
                  className="w-full border p-2 rounded text-sm" placeholder="e.g. 77.2090" required />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Allowed Radius (metres)</label>
              <input type="number" value={geoForm.radius}
                onChange={(e) => setGeoForm((f) => ({ ...f, radius: e.target.value }))}
                className="w-full border p-2 rounded text-sm" min="50" max="5000" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={useMyLocationForSchool}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded">
                📍 Use My Current Location
              </button>
              <button type="submit"
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-semibold">
                Save School Location
              </button>
            </div>
            {saveMsg && <p className="text-sm font-medium text-green-600">{saveMsg}</p>}
          </form>
        ) : geoSettings ? (
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Latitude</p>
              <p className="font-bold text-purple-800">{geoSettings.lat}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Longitude</p>
              <p className="font-bold text-purple-800">{geoSettings.lng}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Radius</p>
              <p className="font-bold text-purple-800">{geoSettings.radiusMeters} m</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-500">⚠️ School location not set. Please configure above.</p>
        )}
      </div>
      )}

      {/* Student view - just show school location info */}
      {userRole === "student" && geoSettings && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-bold text-gray-800 mb-3">🏫 School Location</h3>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Latitude</p>
              <p className="font-bold text-purple-800">{geoSettings.lat}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Longitude</p>
              <p className="font-bold text-purple-800">{geoSettings.lng}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Radius</p>
              <p className="font-bold text-purple-800">{geoSettings.radiusMeters} m</p>
            </div>
          </div>
        </div>
      )}

      {/* Student selector + Location check */}
      {geoSettings && (
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h3 className="font-bold text-gray-800">🎓 Mark Attendance</h3>

          <select value={selectedRoll} onChange={(e) => setSelectedRoll(e.target.value)}
            className="w-full border p-2 rounded-lg text-sm">
            <option value="">-- Select {userRole === "student" ? "Your Name" : "Student Name"} --</option>
            {students.map((s) => (
              <option key={s.rollNumber} value={s.rollNumber}>
                {s.name} — {s.rollNumber} ({s.studentClass})
              </option>
            ))}
          </select>

          <button onClick={fetchLocation} disabled={fetchingLoc}
            className={`w-full py-2 rounded-lg font-semibold text-sm transition ${
              fetchingLoc ? "bg-gray-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}>
            {fetchingLoc ? "⏳ Getting location…" : "📍 Check My Location"}
          </button>

          {locError && <p className="text-red-500 text-sm">{locError}</p>}

          {/* Distance meter */}
          {userLocation && distance !== null && geoSettings && (
            <div className="rounded-xl p-4 text-center border-2" style={{ borderColor: ringColor }}>
              <div className="text-5xl font-black" style={{ color: ringColor }}>
                {distance} m
              </div>
              <p className="text-sm text-gray-500 mt-1">
                from school ·{" "}
                {bearingLabel(geoSettings.lat, geoSettings.lng, userLocation.lat, userLocation.lng)}{" "}
                direction · GPS accuracy ±{Math.round(userLocation.accuracy)}m
              </p>
              <p className="text-sm font-semibold mt-2" style={{ color: ringColor }}>
                {withinRadius
                  ? `✅ Within ${geoSettings.radiusMeters}m radius — Attendance allowed!`
                  : `❌ ${distance - geoSettings.radiusMeters}m outside the allowed zone`}
              </p>
            </div>
          )}

          <button
            onClick={handleGeoAttend}
            disabled={!withinRadius || !selectedRoll || marking || marked[selectedRoll]}
            className={`w-full py-3 rounded-xl font-bold text-sm transition ${
              marked[selectedRoll]
                ? "bg-green-200 text-green-800 cursor-default"
                : withinRadius && selectedRoll && !marking
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}>
            {marked[selectedRoll]
              ? "✅ Already marked today"
              : marking
              ? "Marking…"
              : withinRadius
              ? "✅ Mark Present"
              : "📍 Get location first to enable attendance"}
          </button>
        </div>
      )}

      {/* Marked list */}
      {Object.keys(marked).length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <h4 className="font-bold text-green-800 mb-2">✅ Marked via Geo today</h4>
          <div className="flex flex-wrap gap-2">
            {Object.keys(marked).map((roll) => {
              const s = students.find((x) => x.rollNumber === roll);
              return (
                <span key={roll} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                  {s?.name || roll}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        🔐 <strong>Security:</strong> Location data is verified client-side using the browser's GPS.
        For higher accuracy, use on mobile devices. Admin must configure school coordinates once.
      </div>
    </div>
  );
};

export default GeoAttendance;
