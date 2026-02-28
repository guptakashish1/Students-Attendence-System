import React, { useEffect, useState } from "react";
import {
  getAllFaceDescriptors,
  approveFaceRegistration,
  rejectFaceRegistration,
  listenRegisteredStudents,
  sendTelegramMessage,
} from "../../firebase";

const FaceApproval = ({ userEmail, userRole }) => {
  const [faceRegistrations, setFaceRegistrations] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("pending"); // "pending" | "approved" | "rejected"
  const [loading, setLoading] = useState(true);
  const [rejectingRoll, setRejectingRoll] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubStudents = listenRegisteredStudents(setStudents);
    loadFaceRegistrations();
    return () => unsubStudents();
  }, []);

  async function loadFaceRegistrations() {
    setLoading(true);
    try {
      const descriptors = await getAllFaceDescriptors();
      setFaceRegistrations(descriptors);
    } catch (err) {
      console.error("Error loading face registrations:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRegistrations = faceRegistrations.filter(
    (f) => f.approvalStatus === filter
  );

  function getStudentInfo(rollNumber) {
    return students.find((s) => s.rollNumber === rollNumber);
  }

  async function handleApprove(rollNumber) {
    setProcessing(true);
    setMessage("");
    try {
      await approveFaceRegistration(rollNumber, userEmail);
      
      // Send notification to student and parent
      const student = getStudentInfo(rollNumber);
      if (student) {
        const approvalMsg =
          `✅ *Face Registration Approved*\n\n` +
          `Hello *${student.name}*!\n\n` +
          `Your face biometric registration has been *approved* by the warden.\n\n` +
          `You can now use face recognition for attendance marking.\n\n` +
          `📅 Approved on: ${new Date().toLocaleDateString()}\n` +
          `👤 Approved by: ${userEmail}`;

        if (student.telegramChatId) {
          await sendTelegramMessage(student.telegramChatId, approvalMsg);
        }
        if (student.parentTelegramChatId) {
          await sendTelegramMessage(
            student.parentTelegramChatId,
            `👨‍👩‍👦 *Parent Notification*\n\n` +
            `Your child *${student.name}*'s face biometric registration has been approved.\n\n` +
            `They can now use face recognition for attendance.`
          );
        }
      }

      setMessage(`✅ Face registration approved for ${rollNumber}`);
      await loadFaceRegistrations();
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(rollNumber) {
    if (!rejectReason || rejectReason.trim().length < 10) {
      setMessage("❌ Please provide a rejection reason (minimum 10 characters)");
      return;
    }

    setProcessing(true);
    setMessage("");
    try {
      await rejectFaceRegistration(rollNumber, userEmail, rejectReason);
      
      // Send notification to student and parent
      const student = getStudentInfo(rollNumber);
      if (student) {
        const rejectionMsg =
          `❌ *Face Registration Rejected*\n\n` +
          `Hello *${student.name}*,\n\n` +
          `Your face biometric registration has been *rejected* by the warden.\n\n` +
          `*Reason:* ${rejectReason}\n\n` +
          `Please contact the warden for more information and re-register if needed.\n\n` +
          `📅 Rejected on: ${new Date().toLocaleDateString()}\n` +
          `👤 Rejected by: ${userEmail}`;

        if (student.telegramChatId) {
          await sendTelegramMessage(student.telegramChatId, rejectionMsg);
        }
        if (student.parentTelegramChatId) {
          await sendTelegramMessage(
            student.parentTelegramChatId,
            `👨‍👩‍👦 *Parent Notification*\n\n` +
            `Your child *${student.name}*'s face biometric registration was rejected.\n\n` +
            `*Reason:* ${rejectReason}\n\n` +
            `Please contact the warden for assistance.`
          );
        }
      }

      setMessage(`✅ Face registration rejected for ${rollNumber}`);
      setRejectingRoll(null);
      setRejectReason("");
      await loadFaceRegistrations();
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  if (userRole !== "warden") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">
            Only wardens can access the face approval page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">
          ✅ Face Registration Approval
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve/reject student face registrations for biometric attendance.
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`border rounded-xl p-4 text-sm ${
            message.startsWith("✅")
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-3">
        {["pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
              filter === status
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-purple-50"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} (
            {faceRegistrations.filter((f) => f.approvalStatus === status).length})
          </button>
        ))}
      </div>

      {/* Registrations List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-4">⏳</div>
          <p>Loading registrations...</p>
        </div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📭</div>
          <p>No {filter} registrations found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRegistrations.map((registration) => {
            const student = getStudentInfo(registration.rollNumber);
            const isRejecting = rejectingRoll === registration.rollNumber;

            return (
              <div
                key={registration.rollNumber}
                className="bg-white rounded-2xl shadow p-5 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg">
                      {student?.name || "Unknown Student"}
                    </h3>
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>
                        <strong>Roll Number:</strong> {registration.rollNumber}
                      </p>
                      <p>
                        <strong>Class:</strong> {student?.studentClass || "N/A"}
                      </p>
                      <p>
                        <strong>Registered By:</strong>{" "}
                        {registration.registeredBy || "system"}
                      </p>
                      <p>
                        <strong>Registered At:</strong>{" "}
                        {new Date(registration.registeredAt).toLocaleString()}
                      </p>
                      {registration.approvalStatus === "approved" && (
                        <>
                          <p>
                            <strong>Approved By:</strong>{" "}
                            {registration.approvedBy}
                          </p>
                          <p>
                            <strong>Approved At:</strong>{" "}
                            {new Date(registration.approvedAt).toLocaleString()}
                          </p>
                        </>
                      )}
                      {registration.approvalStatus === "rejected" && (
                        <>
                          <p>
                            <strong>Rejected By:</strong>{" "}
                            {registration.approvedBy}
                          </p>
                          <p>
                            <strong>Rejected At:</strong>{" "}
                            {new Date(registration.approvedAt).toLocaleString()}
                          </p>
                          <p className="text-red-600">
                            <strong>Reason:</strong>{" "}
                            {registration.rejectedReason}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    className={`px-4 py-2 rounded-full text-xs font-bold ${
                      registration.approvalStatus === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : registration.approvalStatus === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {registration.approvalStatus.toUpperCase()}
                  </div>
                </div>

                {/* Actions for Pending */}
                {registration.approvalStatus === "pending" && (
                  <div className="space-y-3 pt-3 border-t">
                    {!isRejecting ? (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(registration.rollNumber)}
                          disabled={processing}
                          className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition ${
                            processing
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() =>
                            setRejectingRoll(registration.rollNumber)
                          }
                          disabled={processing}
                          className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition ${
                            processing
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Enter rejection reason (minimum 10 characters)..."
                          className="w-full border rounded-lg p-3 text-sm"
                          rows="3"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              handleReject(registration.rollNumber)
                            }
                            disabled={processing || rejectReason.trim().length < 10}
                            className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition ${
                              processing || rejectReason.trim().length < 10
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => {
                              setRejectingRoll(null);
                              setRejectReason("");
                            }}
                            disabled={processing}
                            className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>ℹ️ Note:</strong> Students and parents will receive Telegram
        notifications when their face registration is approved or rejected.
      </div>
    </div>
  );
};

export default FaceApproval;
