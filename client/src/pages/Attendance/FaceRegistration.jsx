import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import {
  listenRegisteredStudents,
  saveFaceDescriptor,
  getFaceDescriptor,
} from "../../firebase";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    pending:  { cls: "bg-yellow-100 text-yellow-800", label: "⏳ Pending Approval" },
    approved: { cls: "bg-green-100  text-green-800",  label: "✅ Approved" },
    rejected: { cls: "bg-red-100   text-red-800",     label: "❌ Rejected" },
  }[status] || { cls: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const FaceRegistration = ({ userEmail, userRole }) => {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);
  const [students, setStudents]         = useState([]);
  const [capturing, setCapturing]       = useState(false);
  const [message, setMessage]           = useState("");
  const [messageType, setMessageType]   = useState("info");

  // ── Staff / admin / warden state ─────────────────────────────────────────
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ── Student-mode state ───────────────────────────────────────────────────
  const [myStudent, setMyStudent]         = useState(null);          // matched by email
  const [myFaceRecord, setMyFaceRecord]   = useState(undefined);     // undefined=loading, false=none, obj=found
  const [loadingMyFace, setLoadingMyFace] = useState(false);
  const [cameraOpen, setCameraOpen]       = useState(false);

  // Roll-number fallback (when email doesn't match any record)
  const [rollInput, setRollInput]         = useState("");
  const [rollSearchDone, setRollSearchDone] = useState(false);
  const [rollNotFound, setRollNotFound]   = useState(false);

  const isStudent = userRole === "student";

  // ── Load students list ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenRegisteredStudents((list) => {
      setStudents(list);
      if (isStudent && userEmail) {
        const me = list.find((s) =>
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() ||
          s.parentEmail?.toLowerCase()  === userEmail.toLowerCase()
        );
        if (me) setMyStudent(me);
        // If no match, myStudent stays null → show roll-number fallback
      }
    });
    return () => unsub();
  }, [isStudent, userEmail]);

  // ── Load models ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadModels() {
      try {
        setMessage("Loading face detection models…");
        setMessageType("info");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        setMessage("");
      } catch (err) {
        setMessage("Failed to load face models: " + err.message);
        setMessageType("error");
      }
    }
    loadModels();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch face record when myStudent is resolved ──────────────────────────
  useEffect(() => {
    if (!isStudent || !myStudent) return;
    (async () => {
      setLoadingMyFace(true);
      try {
        const rec = await getFaceDescriptor(myStudent.rollNumber);
        setMyFaceRecord(rec || false);
      } catch (err) {
        console.error("Error loading face record:", err);
        setMyFaceRecord(false); // treat as not registered so student can proceed
      } finally {
        setLoadingMyFace(false);
      }
    })();
  }, [isStudent, myStudent]);

  // ── Camera helpers ────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      // videoRef.current is guaranteed to be in DOM by the time this runs
      // because startCamera is called from a useEffect that fires AFTER render
      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setMessage("❌ Camera element not ready. Please refresh the page.");
        setMessageType("error");
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);
      setMessage("✅ Camera ready. Look straight at the camera.");
      setMessageType("success");
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera access denied. Please allow camera permissions in your browser."
        : `Camera error: ${err.message}`;
      setMessage(msg);
      setMessageType("error");
    }
  }

  // ── Start camera AFTER video element mounts (cameraOpen = true → re-render → useEffect) ──
  useEffect(() => {
    if (cameraOpen && !cameraReady) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraReady(false);
    setCameraOpen(false);
  }

  // ── Staff: pick student from list ─────────────────────────────────────────
  async function handleStudentSelect(rollNumber) {
    const student = students.find((s) => s.rollNumber === rollNumber);
    setSelectedStudent(student);
    setMessage("");
    if (student && modelsLoaded) {
      // Stop existing stream before re-opening
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCameraReady(false);
      }
      await startCamera();
      const existing = await getFaceDescriptor(rollNumber);
      if (existing) {
        setMessage(
          `⚠️ ${student.name} already has a face registration (Status: ${existing.approvalStatus}). Capturing will replace it.`
        );
        setMessageType("info");
      }
    }
  }

  // ── Student: roll-number lookup fallback ──────────────────────────────────
  async function handleRollSearch() {
    const roll = rollInput.trim();
    if (!roll) return;
    const found = students.find((s) => s.rollNumber === roll);
    setRollSearchDone(true);
    if (found) {
      setMyStudent(found);
      setRollNotFound(false);
    } else {
      setRollNotFound(true);
    }
  }

  // ── Student: open camera (startCamera fires via useEffect after re-render) ──
  function handleStudentOpenCamera() {
    setCameraOpen(true);
    setMessage("Opening camera…");
    setMessageType("info");
  }

  // ── Capture & save ────────────────────────────────────────────────────────
  async function captureFace() {
    const target = isStudent ? myStudent : selectedStudent;
    if (!target) {
      setMessage(isStudent ? "Student profile not found." : "Please select a student first.");
      setMessageType("error");
      return;
    }

    // Ensure video is playing before attempting detection
    if (videoRef.current) {
      if (videoRef.current.paused) {
        await videoRef.current.play().catch(() => {});
      }
    }

    // Check video has enough data
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setMessage("⚠️ Camera isn't ready yet. Wait a moment and try again.");
      setMessageType("error");
      return;
    }

    setCapturing(true);
    setMessage("Detecting face… (1/3)");
    setMessageType("info");

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
          setMessage(`Scanning… (${attempt + 2}/3) — look straight at the camera`);
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      if (!detection) {
        setMessage("❌ No face detected after 3 tries. Ensure good lighting, face the camera directly, and remove glasses/mask.");
        setMessageType("error");
        setCapturing(false);
        return;
      }

      // Visual overlay
      const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvasRef.current, dims);
      const resized = faceapi.resizeResults(detection, dims);
      const ctx     = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      await saveFaceDescriptor(target.rollNumber, detection.descriptor, userEmail);

      setMessage(`✅ Face captured for ${target.name}! Pending warden approval.`);
      setMessageType("success");

      if (isStudent) {
        const rec = await getFaceDescriptor(target.rollNumber);
        setMyFaceRecord(rec || false);
        setTimeout(() => { stopCamera(); setMessage(""); }, 3000);
      } else {
        setTimeout(() => { setSelectedStudent(null); stopCamera(); setMessage(""); }, 3000);
      }
    } catch (err) {
      setMessage("Error: " + err.message);
      setMessageType("error");
    } finally {
      setCapturing(false);
    }
  }

  const msgColor = {
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    info:    "bg-blue-50 border-blue-200 text-blue-800",
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  STUDENT VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (isStudent) {
    const faceLoaded  = myFaceRecord !== undefined && !loadingMyFace;
    const canCapture  = faceLoaded && (myFaceRecord === false || myFaceRecord?.approvalStatus === "rejected");

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-purple-700">📷 My Face Registration</h2>
          <p className="text-gray-500 text-sm mt-1">
            Register your face for biometric attendance. The warden will review and approve it.
          </p>
        </div>

        {/* Message banner */}
        {message && (
          <div className={`border rounded-xl p-4 text-sm ${msgColor[messageType] || msgColor.info}`}>
            {message}
          </div>
        )}

        {/* ── Case 1: email matched → show profile + status ── */}
        {myStudent && (
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            {/* Profile row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold text-gray-800 text-lg">{myStudent.name}</p>
                <p className="text-sm text-gray-500">
                  Roll: {myStudent.rollNumber} &middot; Class: {myStudent.studentClass}
                </p>
              </div>
              {loadingMyFace || myFaceRecord === undefined ? (
                <span className="text-xs text-gray-400 animate-pulse">Checking status…</span>
              ) : myFaceRecord ? (
                <StatusBadge status={myFaceRecord.approvalStatus} />
              ) : (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                  Not Registered
                </span>
              )}
            </div>

            {/* Status-specific info */}
            {faceLoaded && myFaceRecord && (
              <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
                <p>
                  <span className="font-semibold">Registered on:</span>{" "}
                  {new Date(myFaceRecord.registeredAt).toLocaleString()}
                </p>
                {myFaceRecord.approvalStatus === "approved" && (
                  <p>
                    <span className="font-semibold">Approved by:</span> {myFaceRecord.approvedBy}{" "}
                    on {new Date(myFaceRecord.approvedAt).toLocaleString()}
                  </p>
                )}
                {myFaceRecord.approvalStatus === "rejected" && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <p className="font-semibold mb-1">Rejection Reason:</p>
                    <p>{myFaceRecord.rejectedReason}</p>
                    <p className="mt-1 text-xs">
                      By {myFaceRecord.approvedBy} on {new Date(myFaceRecord.approvedAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {myFaceRecord.approvalStatus === "pending" && (
                  <p className="text-yellow-700">
                    ⏳ Awaiting warden approval. You will be notified once reviewed.
                  </p>
                )}
              </div>
            )}

            {/* Approved banner */}
            {faceLoaded && myFaceRecord?.approvalStatus === "approved" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-green-800 font-semibold text-sm">
                  Your face is approved! You can now use face recognition for attendance.
                </p>
              </div>
            )}

            {/* Pending banner */}
            {faceLoaded && myFaceRecord?.approvalStatus === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-yellow-800 text-sm font-medium">
                  Your registration is pending warden approval. Please wait.
                </p>
              </div>
            )}

            {/* Capture section (not registered or rejected) */}
            {canCapture && (
              <>
                {myFaceRecord?.approvalStatus === "rejected" && (
                  <p className="text-sm text-gray-600 border-t pt-3">
                    Your previous registration was rejected. You can re-capture your face below.
                  </p>
                )}

                {!cameraOpen ? (
                  <button
                    onClick={handleStudentOpenCamera}
                    disabled={!modelsLoaded}
                    className={`w-full py-3 rounded-lg text-white font-semibold transition ${
                      !modelsLoaded
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                  >
                    {!modelsLoaded ? "⏳ Loading face models…" : "📸 Open Camera & Register"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border-4 border-purple-300">
                      <video ref={videoRef} className="w-full block" muted playsInline />
                      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={captureFace}
                        disabled={capturing || !cameraReady}
                        className={`flex-1 py-3 rounded-lg text-white font-semibold transition ${
                          capturing || !cameraReady
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-purple-600 hover:bg-purple-700"
                        }`}
                      >
                        {capturing ? "Capturing…" : "📸 Capture My Face"}
                      </button>
                      <button
                        onClick={stopCamera}
                        className="px-5 py-3 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Case 2: students list loaded but no email match → roll number fallback ── */}
        {!myStudent && students.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🔗</div>
              <h3 className="font-bold text-gray-800 mb-1">Find Your Student Record</h3>
              <p className="text-gray-500 text-sm">
                Your email (<span className="font-medium">{userEmail}</span>) isn't linked to a student record yet.
                Enter your roll number to continue.
              </p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={rollInput}
                onChange={(e) => { setRollInput(e.target.value); setRollSearchDone(false); setRollNotFound(false); }}
                placeholder="Enter your roll number"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleRollSearch()}
              />
              <button
                onClick={handleRollSearch}
                disabled={!rollInput.trim() || students.length === 0}
                className="px-5 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Search
              </button>
            </div>

            {rollSearchDone && rollNotFound && (
              <p className="text-red-600 text-sm text-center">
                ❌ No student found with roll number "<strong>{rollInput}</strong>". Please check and try again.
              </p>
            )}
          </div>
        )}

        {/* ── Case 3: still loading students ── */}
        {!myStudent && students.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <p className="text-sm">Loading student records…</p>
          </div>
        )}

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>📋 Tips for a good capture:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ensure your face is well-lit and clearly visible</li>
            <li>Look directly at the camera without tilting your head</li>
            <li>Remove sunglasses, masks or other face coverings</li>
            <li>Once submitted, wait for the warden to approve before using face attendance</li>
          </ul>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STAFF / ADMIN / WARDEN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-purple-700">📷 Face Registration</h2>
        <p className="text-gray-500 text-sm mt-1">
          Register student faces for biometric attendance. All registrations require warden approval.
        </p>
      </div>

      {message && (
        <div className={`border rounded-xl p-4 text-sm ${msgColor[messageType] || msgColor.info}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Student list */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h3 className="font-bold text-gray-800">Select Student</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {students.map((student) => (
              <button
                key={student.rollNumber}
                onClick={() => handleStudentSelect(student.rollNumber)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedStudent?.rollNumber === student.rollNumber
                    ? "bg-purple-50 border-purple-300"
                    : "bg-gray-50 border-gray-200 hover:bg-purple-50"
                }`}
              >
                <div className="font-semibold text-gray-800">{student.name}</div>
                <div className="text-xs text-gray-500">
                  Roll: {student.rollNumber} &middot; Class: {student.studentClass}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Camera */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h3 className="font-bold text-gray-800">Capture Face</h3>
          {selectedStudent ? (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-purple-800">Selected: {selectedStudent.name}</p>
                <p className="text-xs text-purple-600">
                  Roll: {selectedStudent.rollNumber} &middot; Class: {selectedStudent.studentClass}
                </p>
              </div>
              {cameraReady && (
                <div className="relative rounded-xl overflow-hidden border-4 border-purple-300">
                  <video ref={videoRef} className="w-full block" muted playsInline />
                  <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                </div>
              )}
              <button
                onClick={captureFace}
                disabled={capturing || !cameraReady}
                className={`w-full px-6 py-3 rounded-lg text-white font-semibold transition ${
                  capturing || !cameraReady ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {capturing ? "Capturing…" : "📸 Capture Face"}
              </button>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">👤</div>
              <p className="text-sm">Select a student to begin</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>📋 Instructions:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Select a student from the list</li>
          <li>Position their face clearly in the camera frame</li>
          <li>Ensure good lighting and face the camera directly</li>
          <li>Click "Capture Face" when ready</li>
          <li>Registration will be sent to warden for approval</li>
        </ul>
      </div>
    </div>
  );
};

export default FaceRegistration;
