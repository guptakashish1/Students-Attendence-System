import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole, listenRegisteredStudents } from "../../firebase";
import { getDatabase, ref, push, set, get } from "firebase/database";

const LEAVE_TYPES = [
  { value: "sick", label: "Sick Leave", icon: "🤒" },
  { value: "emergency", label: "Emergency", icon: "🚨" },
  { value: "family", label: "Family Function", icon: "👨‍👩‍👧" },
  { value: "personal", label: "Personal", icon: "📋" },
  { value: "other", label: "Other", icon: "📝" },
];

const LeaveOuting = () => {
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [myStudent, setMyStudent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [requestType, setRequestType] = useState("outing"); // outing or leave
  const [leaveType, setLeaveType] = useState("");
  const [outingPlace, setOutingPlace] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [application, setApplication] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        const roleData = await getUserRole(user.uid);
        setUserRole(roleData?.role || "student");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    const unsubStudents = listenRegisteredStudents((students) => {
      if (userRole === "student") {
        const student = students.find(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setMyStudent(student);
        if (student) {
          // Pre-fill guardian contact from student record
          setGuardianContact(student.contact || "");
        }
      }
    });

    loadMyRequests();

    return () => {
      unsubStudents();
    };
  }, [userEmail, userRole]); // eslint-disable-line

  const loadMyRequests = async () => {
    if (!userEmail) return;
    try {
      const db = getDatabase();
      const requestsRef = ref(db, "leaveOutingRequests");
      const snapshot = await get(requestsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const myRequests = Object.values(data)
          .filter(r => r.studentEmail?.toLowerCase() === userEmail.toLowerCase())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(myRequests);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!myStudent) {
      alert("Student profile not found!");
      return;
    }

    if (myStudent.residenceType !== "hostler") {
      alert("This feature is only available for hostler students!");
      return;
    }

    // Validation
    if (requestType === "outing") {
      if (!outingPlace || !fromDate || !fromTime || !toTime || !purpose || !guardianContact) {
        alert("Please fill all required fields for outing request!");
        return;
      }
    } else {
      if (!leaveType || !fromDate || !toDate || !purpose || !guardianContact || !guardianAddress || !application) {
        alert("Please fill all required fields for leave request!");
        return;
      }
    }

    // Validate guardian contact
    if (guardianContact.length !== 10 || !/^\d+$/.test(guardianContact)) {
      alert("Please enter a valid 10-digit guardian contact number!");
      return;
    }

    // Check if guardian contact matches registered contact
    if (myStudent.contact && guardianContact !== myStudent.contact) {
      const confirm = window.confirm(
        `The contact number you entered (${guardianContact}) doesn't match your registered parent contact (${myStudent.contact}).\n\nDo you want to continue?`
      );
      if (!confirm) return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const requestsRef = ref(db, "leaveOutingRequests");
      const newRequestRef = push(requestsRef);

      const requestData = {
        id: newRequestRef.key,
        requestType: requestType,
        studentName: myStudent.name,
        studentEmail: userEmail,
        rollNumber: myStudent.rollNumber,
        className: myStudent.studentClass,
        section: myStudent.classArm || "",
        residenceType: myStudent.residenceType,
        
        // Type specific fields
        ...(requestType === "outing" ? {
          outingPlace: outingPlace,
          fromDate: fromDate,
          fromTime: fromTime,
          toTime: toTime,
        } : {
          leaveType: leaveType,
          fromDate: fromDate,
          toDate: toDate,
          guardianAddress: guardianAddress,
          application: application,
        }),
        
        // Common fields
        purpose: purpose,
        guardianContact: guardianContact,
        
        // Status
        status: "pending",
        approvedBy: null,
        approvedAt: null,
        rejectedReason: null,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await set(newRequestRef, requestData);
      
      // Reset form
      setRequestType("outing");
      setLeaveType("");
      setOutingPlace("");
      setFromDate("");
      setToDate("");
      setFromTime("");
      setToTime("");
      setPurpose("");
      setGuardianAddress("");
      setApplication("");
      
      alert(`✅ ${requestType === "outing" ? "Outing" : "Leave"} request submitted successfully!`);
      loadMyRequests();
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("❌ Error submitting request: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "approved": return "#10b981";
      case "rejected": return "#ef4444";
      default: return "#9ca3af";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending": return "⏳ Pending";
      case "approved": return "✅ Approved";
      case "rejected": return "❌ Rejected";
      default: return "📋 Unknown";
    }
  };

  // Check if student is hostler
  if (myStudent && myStudent.residenceType !== "hostler") {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-2xl font-bold text-yellow-700 mb-2">Day Scholar Student</h2>
          <p className="text-yellow-600">
            Leave/Outing requests are only available for hostler students.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-600 mb-2">🚪 Leave / Outing Request</h1>
      <p className="text-gray-600 mb-6">Request leave for multiple days or outing for same-day trips</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Submit New Request</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Request Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Request Type *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestType("outing")}
                  className={`p-4 rounded-lg border-2 transition ${
                    requestType === "outing"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-300 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="text-3xl mb-2">🚶</div>
                  <div className="font-bold text-gray-800">Outing</div>
                  <div className="text-xs text-gray-600">Same day trip</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType("leave")}
                  className={`p-4 rounded-lg border-2 transition ${
                    requestType === "leave"
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-300 bg-white hover:border-purple-300"
                  }`}
                >
                  <div className="text-3xl mb-2">🏖️</div>
                  <div className="font-bold text-gray-800">Leave</div>
                  <div className="text-xs text-gray-600">Multiple days</div>
                </button>
              </div>
            </div>

            {/* Leave Type (only for leave) */}
            {requestType === "leave" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Leave Type *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                >
                  <option value="">Select Leave Type</option>
                  {LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Outing Place (only for outing) */}
            {requestType === "outing" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Outing Place *</label>
                <input
                  type="text"
                  value={outingPlace}
                  onChange={(e) => setOutingPlace(e.target.value)}
                  placeholder="Where are you going?"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>
            )}

            {/* Date Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">From Date *</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>
              {requestType === "leave" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Date *</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    min={fromDate || new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
              )}
            </div>

            {/* Time Fields (only for outing) */}
            {requestType === "outing" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">From Time *</label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Time *</label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {/* Purpose */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose *</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Brief purpose of your request"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>

            {/* Local Guardian Contact */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Local Guardian Contact No *
              </label>
              <input
                type="tel"
                value={guardianContact}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setGuardianContact(value);
                }}
                placeholder="10-digit contact number"
                maxLength={10}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
              {myStudent?.contact && (
                <p className="text-xs text-gray-500 mt-1">
                  Registered contact: {myStudent.contact}
                </p>
              )}
            </div>

            {/* Guardian Address (only for leave) */}
            {requestType === "leave" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Local Guardian Address *
                </label>
                <textarea
                  value={guardianAddress}
                  onChange={(e) => setGuardianAddress(e.target.value)}
                  placeholder="Complete address where you'll be staying"
                  rows={2}
                  maxLength={100}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{guardianAddress.length}/100</p>
              </div>
            )}

            {/* Application (only for leave) */}
            {requestType === "leave" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Application *
                </label>
                <textarea
                  value={application}
                  onChange={(e) => setApplication(e.target.value)}
                  placeholder="Write your detailed application..."
                  rows={4}
                  maxLength={200}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{application.length}/200</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-bold text-white transition ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Submitting..." : `📤 Submit ${requestType === "outing" ? "Outing" : "Leave"} Request`}
            </button>
          </form>
        </div>

        {/* My Requests */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            My Requests ({requests.length})
          </h2>
          
          <div className="space-y-3 max-h-[700px] overflow-y-auto">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-3">📭</div>
                <p>No requests submitted yet</p>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="border-2 rounded-lg p-4 hover:shadow-md transition"
                  style={{ borderColor: getStatusColor(request.status) + "40" }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {request.requestType === "outing" ? "🚶" : "🏖️"}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-800">
                          {request.requestType === "outing" ? "Outing Request" : "Leave Request"}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: getStatusColor(request.status) + "20",
                        color: getStatusColor(request.status),
                      }}
                    >
                      {getStatusLabel(request.status)}
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1 mb-2">
                    {request.requestType === "outing" ? (
                      <>
                        <p><strong>Place:</strong> {request.outingPlace}</p>
                        <p><strong>Date:</strong> {request.fromDate}</p>
                        <p><strong>Time:</strong> {request.fromTime} - {request.toTime}</p>
                      </>
                    ) : (
                      <>
                        <p><strong>Type:</strong> {LEAVE_TYPES.find(t => t.value === request.leaveType)?.label || request.leaveType}</p>
                        <p><strong>Duration:</strong> {request.fromDate} to {request.toDate}</p>
                      </>
                    )}
                    <p><strong>Purpose:</strong> {request.purpose}</p>
                    <p><strong>Contact:</strong> {request.guardianContact}</p>
                  </div>

                  {request.status === "rejected" && request.rejectedReason && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-2 mt-2">
                      <p className="text-xs text-red-800">
                        <strong>Rejection Reason:</strong> {request.rejectedReason}
                      </p>
                    </div>
                  )}

                  {request.status === "approved" && request.approvedBy && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-2 mt-2">
                      <p className="text-xs text-green-800">
                        <strong>Approved by:</strong> {request.approvedBy} on {new Date(request.approvedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveOuting;
