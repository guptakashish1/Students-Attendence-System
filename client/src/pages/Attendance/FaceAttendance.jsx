import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import {
  listenRegisteredStudents,
  getApprovedFaceDescriptors,
  getFaceDescriptor,
  saveFaceDescriptor,
  markAttendance,
  sendTelegramMessage,
  getTodayDate,
} from "../../firebase";

const MODEL_URL       = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";
const MATCH_THRESHOLD = 0.5;

const STATUS_COLOR = {
  loading  : "#6366f1",
  ready    : "#22c55e",
  scanning : "#f59e0b",
  matched  : "#22c55e",
  unknown  : "#ef4444",
};

const StatusBadge = ({ status }) => {
  const cfg = {
    pending  : { cls: "bg-yellow-100 text-yellow-800", label: "⏳ Pending Approval" },
    approved : { cls: "bg-green-100  text-green-800",  label: "✅ Approved" },
    rejected : { cls: "bg-red-100   text-red-800",     label: "❌ Rejected" },
  }[status] || { cls: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const FaceAttendance = ({ userEmail, userRole }) => {
  // ── single video element shared across both tabs ─────────────────────────
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);

  // ── shared state ─────────────────────────────────────────────────────────
  const [status,       setStatus]       = useState("loading");
  const [statusMsg,    setStatusMsg]    = useState("Loading face models…");
  const [students,     setStudents]     = useState([]);
  const [labeledFaces, setLabeledFaces] = useState(null);
  const [lastMatch,    setLastMatch]    = useState(null);
  const [markedToday,  setMarkedToday]  = useState({});
  const [modelsReady,  setModelsReady]  = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);

  // ── admin mode toggle ────────────────────────────────────────────────────
  const [mode,       setMode]       = useState("attend");
  const [regRoll,    setRegRoll]    = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regMsg,     setRegMsg]     = useState("");

  // ── student state ────────────────────────────────────────────────────────
  const [userStudent,    setUserStudent]    = useState(null);
  const [myFaceRecord,   setMyFaceRecord]   = useState(undefined); // undefined=loading, false=none
  const [loadingFaceRec, setLoadingFaceRec] = useState(false);
  const [studentTab,     setStudentTab]     = useState("attend");
  const [capturing,      setCapturing]      = useState(false);
  const [captureMsg,     setCaptureMsg]     = useState("");
  const [captureMsgType, setCaptureMsgType] = useState("info");

  // roll-number fallback
  const [rollInput,      setRollInput]      = useState("");
  const [rollSearchDone, setRollSearchDone] = useState(false);
  const [rollNotFound,   setRollNotFound]   = useState(false);

  const isAdminOrWarden = ["admin", "warden", "teacher", "staff"].includes(userRole);
  const isStudent       = userRole === "student";

  // ── 1. load students + models ────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenRegisteredStudents((list) => {
      setStudents(list);
      if (isStudent && userEmail) {
        const me = list.find(
          (s) =>
            s.studentEmail?.toLowerCase() === userEmail.toLowerCase() ||
            s.parentEmail?.toLowerCase()  === userEmail.toLowerCase()
        );
        setUserStudent(me || null);
      }
    });
    loadModels();
    return () => { unsub(); stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, userRole]);

  // ── 2. load student's face record ────────────────────────────────────────
  useEffect(() => {
    if (!isStudent || !userStudent) return;
    (async () => {
      setLoadingFaceRec(true);
      try {
        const rec = await getFaceDescriptor(userStudent.rollNumber);
        setMyFaceRecord(rec || false);
        // auto-switch to register tab if face not yet approved
        if (!rec || rec.approvalStatus !== "approved") setStudentTab("register");
      } catch (err) {
        console.error("Error loading face record:", err);
        setMyFaceRecord(false); // treat as not registered so student can proceed
      } finally {
        setLoadingFaceRec(false);
      }
    })();
  }, [isStudent, userStudent]);

  // ── 3. re-attach stream to video when tab changes ─────────────────────────
  //    (the video element is always in the DOM but React re-uses the same ref;
  //     we still need to ensure srcObject is set after any layout change)
  useEffect(() => {
    if (!streamRef.current || !videoRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
    // manage scanning
    if (isStudent) {
      if (studentTab === "register") {
        clearInterval(intervalRef.current);
      } else if (studentTab === "attend" && labeledFaces) {
        startScanning();
      }
    }
  }, [studentTab]); // eslint-disable-line

  // ── model loading ─────────────────────────────────────────────────────────
  async function loadModels() {
    try {
      setStatusMsg("Downloading face models (first load ~10 s)…");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsReady(true);
      setStatusMsg("Models ready. Starting camera…");
      await startCamera();
    } catch (err) {
      setStatus("unknown");
      setStatusMsg("Failed to load models: " + err.message);
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current          = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("ready");
      setCameraReady(true);
      setStatusMsg("Camera ready — point a face at the camera");
    } catch {
      setStatus("unknown");
      setStatusMsg("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  // ── build FaceMatcher ─────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "ready") return;
    buildFaceMatcher();
  }, [status, students]); // eslint-disable-line

  async function buildFaceMatcher() {
    try {
      const stored = await getApprovedFaceDescriptors();
      if (stored.length === 0) {
        setStatusMsg("No approved face registrations yet.");
        return;
      }
      const labeled = stored.map(
        (s) => new faceapi.LabeledFaceDescriptors(s.rollNumber, [new Float32Array(s.descriptor)])
      );
      const matcher = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
      setLabeledFaces(matcher);
      setStatusMsg(`Matcher ready (${stored.length} face${stored.length > 1 ? "s" : ""}). Scanning…`);
      // only start scanning if in attend mode
      if (!isStudent || studentTab === "attend") startScanning();
    } catch (err) {
      setStatusMsg("Error loading face data: " + err.message);
    }
  }

  // ── scan loop ─────────────────────────────────────────────────────────────
  function startScanning() {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(scanFrame, 1200);
  }

  async function scanFrame() {
    if (!videoRef.current || !canvasRef.current || !labeledFaces) return;
    setStatus("scanning");
    try {
      const options    = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      const detections = await faceapi
        .detectAllFaces(videoRef.current, options)
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvasRef.current, dims);
      const resized = faceapi.resizeResults(detections, dims);
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      if (detections.length === 0) {
        setStatus("ready");
        setStatusMsg("No face detected. Move closer.");
        setLastMatch(null);
        return;
      }

      const best = labeledFaces.findBestMatch(detections[0].descriptor);
      if (best.label === "unknown") {
        setStatus("unknown");
        setStatusMsg(`Face not recognized (dist: ${best.distance.toFixed(2)}). Register first.`);
        setLastMatch(null);
      } else {
        const student = students.find((s) => s.rollNumber === best.label);
        if (!student) return;
        setStatus("matched");
        setLastMatch({ student, distance: best.distance });
        if (!markedToday[best.label]) await autoMarkAttendance(student);
        else setStatusMsg(`✅ ${student.name} — already marked today`);
      }
    } catch (err) {
      setStatusMsg("Scan error: " + err.message);
    }
  }

  async function autoMarkAttendance(student) {
    const today = getTodayDate();
    await markAttendance(student, today, "IN");
    setMarkedToday((p) => ({ ...p, [student.rollNumber]: true }));
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setStatusMsg(`✅ ${student.name} marked Present at ${time}`);
    if (student.telegramChatId) {
      await sendTelegramMessage(
        student.telegramChatId,
        `📸 *Face Attendance Confirmed*\n\nHello *${student.name}*!\n\n` +
        `✅ Attendance marked via *face recognition* at *${time}* on ${today}.\n\n` +
        `If this wasn't you, contact admin immediately.`
      );
    }
  }

  // ── admin: register face ──────────────────────────────────────────────────
  async function captureAndRegisterFace() {
    if (!regRoll) { setRegMsg("Select a student first."); return; }
    setRegLoading(true);
    setRegMsg("Capturing face…");
    try {
      const options   = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      const detection = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      if (!detection) { setRegMsg("❌ No face detected."); setRegLoading(false); return; }
      await saveFaceDescriptor(regRoll, detection.descriptor, userEmail);
      setRegMsg(`✅ Registered for roll ${regRoll}! Pending warden approval.`);
      await buildFaceMatcher();
    } catch (err) {
      setRegMsg("Error: " + err.message);
    } finally {
      setRegLoading(false);
    }
  }

  // ── student: capture own face ─────────────────────────────────────────────
  async function captureMyFace() {
    if (!userStudent) {
      setCaptureMsg("Student profile not found.");
      setCaptureMsgType("error");
      return;
    }

    // Ensure stream is attached and video is playing
    if (streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      if (videoRef.current.paused) {
        await videoRef.current.play().catch(() => {});
      }
    }

    // Check video has enough data to scan
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setCaptureMsg("⚠️ Camera not ready yet. Wait a moment and try again.");
      setCaptureMsgType("error");
      return;
    }

    setCapturing(true);
    setCaptureMsg("Detecting face… (1/3)");
    setCaptureMsgType("info");
    try {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });

      // Retry up to 3 times to handle momentary bad frames
      let detection = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        detection = await faceapi
          .detectSingleFace(videoRef.current, options)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (detection) break;
        if (attempt < 2) {
          setCaptureMsg(`Scanning… (${attempt + 2}/3) — look straight at the camera`);
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      if (!detection) {
        setCaptureMsg("❌ No face detected after 3 tries. Ensure good lighting, face the camera directly, and remove glasses/mask.");
        setCaptureMsgType("error");
        setCapturing(false);
        return;
      }

      const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvasRef.current, dims);
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceapi.draw.drawDetections(canvasRef.current, faceapi.resizeResults(detection, dims));
      faceapi.draw.drawFaceLandmarks(canvasRef.current, faceapi.resizeResults(detection, dims));

      await saveFaceDescriptor(userStudent.rollNumber, detection.descriptor, userEmail);

      const rec = await getFaceDescriptor(userStudent.rollNumber);
      setMyFaceRecord(rec || false);

      setCaptureMsg("✅ Face captured successfully! Pending warden approval.");
      setCaptureMsgType("success");
      setTimeout(() => setCaptureMsg(""), 5000);
    } catch (err) {
      setCaptureMsg("Error: " + err.message);
      setCaptureMsgType("error");
    } finally {
      setCapturing(false);
    }
  }

  // ── roll number fallback ──────────────────────────────────────────────────
  function handleRollSearch() {
    const roll  = rollInput.trim();
    if (!roll) return;
    const found = students.find((s) => s.rollNumber === roll);
    setRollSearchDone(true);
    if (found) { setUserStudent(found); setRollNotFound(false); }
    else        { setRollNotFound(true); }
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const color       = STATUS_COLOR[status] || "#9ca3af";
  const faceLoaded  = myFaceRecord !== undefined && !loadingFaceRec;
  const canCapture  = faceLoaded && (myFaceRecord === false || myFaceRecord?.approvalStatus === "rejected");

  const captureMsgColor = {
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    info:    "bg-blue-50 border-blue-200 text-blue-800",
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  STUDENT VIEW
  //  ─ the <video> / <canvas> are ALWAYS in the DOM so the stream ref stays
  //    attached regardless of which tab is active.
  // ══════════════════════════════════════════════════════════════════════════
  if (isStudent) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-purple-700">📷 Face Recognition</h2>
          <p className="text-gray-500 text-sm mt-1">
            Mark your attendance or register your face for biometric attendance.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl overflow-hidden border border-purple-200 w-fit">
          {[
            { id: "attend",   label: "🎯 Mark Attendance"  },
            { id: "register", label: "🙂 Register My Face" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStudentTab(tab.id)}
              className={`px-6 py-2.5 font-semibold text-sm transition ${
                studentTab === tab.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:bg-purple-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CAMERA — always mounted; scanning controlled by tab ── */}
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-xl border-4"
          style={{ borderColor: studentTab === "attend" ? color : "#a855f7" }}
        >
          <video ref={videoRef} className="w-full block" muted playsInline />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
          {/* Status bar: only meaningful in attend mode */}
          {studentTab === "attend" && (
            <div
              className="absolute bottom-0 left-0 right-0 px-4 py-2 text-white text-sm font-semibold"
              style={{ background: color + "cc" }}
            >
              {statusMsg}
            </div>
          )}
          {/* Register mode hint overlay — always visible on register tab */}
          {studentTab === "register" && (
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 text-white text-sm font-semibold bg-purple-600 bg-opacity-80">
              📸 Position your face in frame, then click Register below
            </div>
          )}
        </div>

        {/* ── TAB: MARK ATTENDANCE ─────────────────────────────────── */}
        {studentTab === "attend" && (
          <div className="space-y-4">
            {/* Face status banners */}
            {faceLoaded && myFaceRecord === false && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📝</span>
                  <div>
                    <p className="font-semibold text-blue-800 text-sm">Face not registered yet</p>
                    <p className="text-blue-700 text-xs mt-1">
                      Register your face so the system can recognize you for attendance.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStudentTab("register")}
                  className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:scale-95 transition"
                >
                  🙂 Register My Face Now →
                </button>
              </div>
            )}

            {faceLoaded && myFaceRecord?.approvalStatus === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <p className="font-semibold text-yellow-800 text-sm">Pending warden approval</p>
                  <p className="text-yellow-700 text-xs mt-1">
                    Face attendance will activate once your registration is approved.
                  </p>
                </div>
              </div>
            )}

            {faceLoaded && myFaceRecord?.approvalStatus === "rejected" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">❌</span>
                  <div>
                    <p className="font-semibold text-red-800 text-sm">Registration rejected</p>
                    <p className="text-red-700 text-xs mt-1">
                      Reason: {myFaceRecord.rejectedReason}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStudentTab("register")}
                  className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:scale-95 transition"
                >
                  🔄 Re-register My Face →
                </button>
              </div>
            )}

            {/* Last match */}
            {lastMatch && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                <div className="text-4xl">✅</div>
                <div>
                  <p className="font-bold text-green-800 text-lg">{lastMatch.student.name}</p>
                  <p className="text-sm text-green-700">
                    Roll: {lastMatch.student.rollNumber} · Confidence:{" "}
                    {((1 - lastMatch.distance) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Marked today */}
            {Object.keys(markedToday).length > 0 && (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-bold text-gray-700 mb-3">
                  ✅ Marked Present Today ({Object.keys(markedToday).length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(markedToday).map((roll) => {
                    const s = students.find((x) => x.rollNumber === roll);
                    return (
                      <span key={roll} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {s?.name || roll}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: REGISTER MY FACE ────────────────────────────────── */}
        {studentTab === "register" && (
          <div className="space-y-4">

            {/* ── REGISTER BUTTON — always visible, state-driven label/disabled ── */}
            <div className="space-y-2">
              {captureMsg && (
                <div className={`border rounded-xl p-3 text-sm ${captureMsgColor[captureMsgType]}`}>
                  {captureMsg}
                </div>
              )}

              {/* derive button label and disabled state */}
              {(() => {
                const isDisabled =
                  capturing ||
                  !modelsReady ||
                  !cameraReady ||
                  !userStudent ||
                  !faceLoaded ||
                  (myFaceRecord && myFaceRecord.approvalStatus === "pending") ||
                  (myFaceRecord && myFaceRecord.approvalStatus === "approved");

                const label = !modelsReady
                  ? "⏳ Loading face models…"
                  : !cameraReady
                  ? "⏳ Starting camera…"
                  : !userStudent
                  ? "🔍 Find your student record below first"
                  : loadingFaceRec || myFaceRecord === undefined
                  ? "⏳ Checking registration status…"
                  : myFaceRecord?.approvalStatus === "approved"
                  ? "✅ Face already approved — use Mark Attendance"
                  : myFaceRecord?.approvalStatus === "pending"
                  ? "⏳ Awaiting warden approval…"
                  : capturing
                  ? "🔄 Capturing…"
                  : myFaceRecord?.approvalStatus === "rejected"
                  ? "🔄 Re-register My Face"
                  : "📸 Register My Face";

                return (
                  <button
                    onClick={captureMyFace}
                    disabled={isDisabled}
                    className={`w-full py-4 rounded-2xl text-white font-bold transition text-lg shadow-lg ${
                      isDisabled
                        ? "bg-gray-400 cursor-not-allowed opacity-80"
                        : "bg-purple-600 hover:bg-purple-700 active:scale-95"
                    }`}
                  >
                    {label}
                  </button>
                );
              })()}

              {canCapture && userStudent && (
                <p className="text-center text-xs text-gray-400">
                  Look straight at the camera above, then click the button
                </p>
              )}
            </div>

            {/* Roll number fallback — student record not linked to email */}
            {!userStudent && students.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-5 space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🔗</div>
                  <h3 className="font-bold text-gray-800 mb-1">Find Your Student Record</h3>
                  <p className="text-gray-500 text-sm">
                    Email <span className="font-medium">{userEmail}</span> isn't linked to a student record. Enter your roll number.
                  </p>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={rollInput}
                    onChange={(e) => { setRollInput(e.target.value); setRollSearchDone(false); setRollNotFound(false); }}
                    placeholder="Your roll number"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleRollSearch()}
                  />
                  <button
                    onClick={handleRollSearch}
                    disabled={!rollInput.trim()}
                    className="px-5 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Search
                  </button>
                </div>
                {rollSearchDone && rollNotFound && (
                  <p className="text-red-600 text-sm text-center">
                    ❌ No student found with roll number "<strong>{rollInput}</strong>".
                  </p>
                )}
              </div>
            )}

            {!userStudent && students.length === 0 && (
              <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-400">
                <div className="text-4xl mb-3 animate-pulse">⏳</div>
                <p className="text-sm">Loading student records…</p>
              </div>
            )}

            {/* Student profile card — name, status, details */}
            {userStudent && faceLoaded && (
              <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-gray-800 text-lg">{userStudent.name}</p>
                    <p className="text-sm text-gray-500">
                      Roll: {userStudent.rollNumber} · Class: {userStudent.studentClass}
                    </p>
                  </div>
                  {myFaceRecord ? (
                    <StatusBadge status={myFaceRecord.approvalStatus} />
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                      Not Registered
                    </span>
                  )}
                </div>

                {myFaceRecord && (
                  <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
                    <p>
                      <span className="font-semibold">Registered on:</span>{" "}
                      {new Date(myFaceRecord.registeredAt).toLocaleString()}
                    </p>
                    {myFaceRecord.approvalStatus === "approved" && (
                      <p><span className="font-semibold">Approved by:</span> {myFaceRecord.approvedBy}</p>
                    )}
                    {myFaceRecord.approvalStatus === "rejected" && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        <p className="font-semibold mb-1">Rejection Reason:</p>
                        <p>{myFaceRecord.rejectedReason}</p>
                        <p className="mt-1 text-xs">By {myFaceRecord.approvedBy}</p>
                      </div>
                    )}
                    {myFaceRecord.approvalStatus === "pending" && (
                      <p className="text-yellow-700">⏳ Awaiting warden approval.</p>
                    )}
                  </div>
                )}

                {myFaceRecord?.approvalStatus === "approved" && (
                  <button
                    onClick={() => setStudentTab("attend")}
                    className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition"
                  >
                    🎉 Face Approved → Go to Mark Attendance
                  </button>
                )}
              </div>
            )}

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <strong>📋 Tips for a good capture:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ensure your face is well-lit and clearly visible</li>
                <li>Look directly at the camera without tilting your head</li>
                <li>Remove sunglasses, masks, or face coverings</li>
                <li>After capture, the warden will review and approve your registration</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ADMIN / WARDEN / TEACHER / STAFF VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-purple-700">📷 Face Recognition Attendance</h2>
        <p className="text-gray-500 text-sm mt-1">
          Students are auto-marked Present when their face is recognized. A Telegram confirmation is sent instantly.
        </p>
      </div>

      {isAdminOrWarden && (
        <div className="flex gap-3">
          {["attend", "register"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
                mode === m ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-purple-50"
              }`}
            >
              {m === "attend" ? "🎯 Attend Mode" : "➕ Register Face"}
            </button>
          ))}
        </div>
      )}

      <div className="relative inline-block w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl border-4" style={{ borderColor: color }}>
        <video ref={videoRef} className="w-full block" muted playsInline />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 text-white text-sm font-semibold" style={{ background: color + "cc" }}>
          {statusMsg}
        </div>
      </div>

      {mode === "register" && isAdminOrWarden && (
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h3 className="font-bold text-gray-800">➕ Register Student Face</h3>
          <p className="text-sm text-gray-500">Select a student, position their face, then click Capture.</p>
          <select value={regRoll} onChange={(e) => setRegRoll(e.target.value)} className="w-full border p-2 rounded-lg text-sm">
            <option value="">-- Select Student --</option>
            {students.map((s) => (
              <option key={s.rollNumber} value={s.rollNumber}>
                {s.name} — {s.rollNumber} ({s.studentClass})
              </option>
            ))}
          </select>
          <button
            onClick={captureAndRegisterFace}
            disabled={regLoading}
            className={`px-6 py-2 rounded-lg text-white font-semibold text-sm transition ${regLoading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
          >
            {regLoading ? "Capturing…" : "📸 Capture & Register"}
          </button>
          {regMsg && <p className="text-sm font-medium" style={{ color: regMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{regMsg}</p>}
        </div>
      )}

      {lastMatch && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
          <div className="text-4xl">✅</div>
          <div>
            <p className="font-bold text-green-800 text-lg">{lastMatch.student.name}</p>
            <p className="text-sm text-green-700">
              Roll: {lastMatch.student.rollNumber} · Confidence: {((1 - lastMatch.distance) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {Object.keys(markedToday).length > 0 && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3">✅ Marked Present Today ({Object.keys(markedToday).length})</h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(markedToday).map((roll) => {
              const s = students.find((x) => x.rollNumber === roll);
              return (
                <span key={roll} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {s?.name || roll}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        ℹ️ <strong>Note:</strong> Switch to Register Face mode to capture student faces. All registrations require warden approval.
      </div>
    </div>
  );
};

export default FaceAttendance;
