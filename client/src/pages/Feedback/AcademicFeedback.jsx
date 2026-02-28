import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole, listenRegisteredStudents, listenCollection } from "../../firebase";
import { getDatabase, ref, push, set } from "firebase/database";

const ISSUE_CATEGORIES = [
  { value: "sanitation", label: "🚽 Sanitation", icon: "🚽" },
  { value: "smartboard", label: "📺 Smartboard Issue", icon: "📺" },
  { value: "classroom", label: "🏫 Classroom Facilities", icon: "🏫" },
  { value: "library", label: "📚 Library", icon: "📚" },
  { value: "laboratory", label: "🔬 Laboratory", icon: "🔬" },
  { value: "sports", label: "⚽ Sports Facilities", icon: "⚽" },
  { value: "canteen", label: "🍽️ Canteen", icon: "🍽️" },
  { value: "transport", label: "🚌 Transport", icon: "🚌" },
  { value: "infrastructure", label: "🏗️ Infrastructure", icon: "🏗️" },
  { value: "other", label: "📋 Other", icon: "📋" },
];

const PRIORITY_LEVELS = [
  { value: "low", label: "Low", color: "#10b981" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high", label: "High", color: "#ef4444" },
  { value: "urgent", label: "Urgent", color: "#dc2626" },
];

const AcademicFeedback = () => {
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [myStudent, setMyStudent] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [anonymous, setAnonymous] = useState(false);

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
      }
    });

    const unsubFeedbacks = listenCollection("academicFeedback", (data) => {
      // Filter feedbacks for students - only show their own
      if (userRole === "student" && userEmail) {
        const myFeedbacks = data.filter(f => 
          f.studentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setFeedbacks(myFeedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        setFeedbacks(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
    });

    return () => {
      unsubStudents();
      unsubFeedbacks();
    };
  }, [userEmail, userRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !title || !description) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const feedbackRef = ref(db, "academicFeedback");
      const newFeedbackRef = push(feedbackRef);

      const feedbackData = {
        id: newFeedbackRef.key,
        category,
        priority,
        title,
        description,
        location: location || "Not specified",
        anonymous,
        studentName: anonymous ? "Anonymous" : (myStudent?.name || "Unknown"),
        studentEmail: userEmail,
        rollNumber: myStudent?.rollNumber || "N/A",
        studentClass: myStudent?.studentClass || "N/A",
        classArm: myStudent?.classArm || "",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await set(newFeedbackRef, feedbackData);
      
      // Reset form
      setCategory("");
      setPriority("medium");
      setTitle("");
      setDescription("");
      setLocation("");
      setAnonymous(false);
      
      alert("✅ Feedback submitted successfully! The administration will review it soon.");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("❌ Error submitting feedback: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "in-progress": return "#3b82f6";
      case "resolved": return "#10b981";
      case "rejected": return "#ef4444";
      default: return "#9ca3af";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending": return "⏳ Pending";
      case "in-progress": return "🔄 In Progress";
      case "resolved": return "✅ Resolved";
      case "rejected": return "❌ Rejected";
      default: return "📋 Unknown";
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-600 mb-2">📢 Academic Feedback</h1>
      <p className="text-gray-600 mb-6">Report issues related to facilities, infrastructure, and academic environment</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Feedback Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Submit New Feedback</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                      category === cat.value
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-purple-300"
                    }`}
                  >
                    <span className="mr-2">{cat.icon}</span>
                    {cat.label.replace(/^.+ /, "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority Level *</label>
              <div className="flex gap-2">
                {PRIORITY_LEVELS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 transition text-sm font-semibold ${
                      priority === p.value
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-purple-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the issue"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Room 101, Ground Floor, Lab 2"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Detailed Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide detailed information about the issue..."
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                required
              />
            </div>

            {/* Anonymous */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">
                Submit anonymously (your name will be hidden)
              </label>
            </div>

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
              {loading ? "Submitting..." : "📤 Submit Feedback"}
            </button>
          </form>
        </div>

        {/* My Feedbacks */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {userRole === "student" ? "My Submitted Feedbacks" : "All Feedbacks"} ({feedbacks.length})
          </h2>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {feedbacks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-3">📭</div>
                <p>No feedbacks submitted yet</p>
              </div>
            ) : (
              feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="border-2 rounded-lg p-4 hover:shadow-md transition"
                  style={{ borderColor: getStatusColor(feedback.status) + "40" }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {ISSUE_CATEGORIES.find(c => c.value === feedback.category)?.icon || "📋"}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-800">{feedback.title}</h3>
                        <p className="text-xs text-gray-500">
                          {feedback.studentName} • {feedback.studentClass}
                          {feedback.classArm ? ` - ${feedback.classArm}` : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: getStatusColor(feedback.status) + "20",
                        color: getStatusColor(feedback.status),
                      }}
                    >
                      {getStatusLabel(feedback.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{feedback.description}</p>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>📍 {feedback.location}</span>
                    <span>•</span>
                    <span>🔔 {feedback.priority}</span>
                    <span>•</span>
                    <span>📅 {new Date(feedback.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicFeedback;
