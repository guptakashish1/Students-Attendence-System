import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole, listenRegisteredStudents, listenCollection } from "../../firebase";
import { getDatabase, ref, push, set } from "firebase/database";

const FEEDBACK_TYPES = [
  { value: "teaching", label: "👨‍🏫 Teaching Method", icon: "👨‍🏫" },
  { value: "content", label: "📚 Course Content", icon: "📚" },
  { value: "pace", label: "⏱️ Teaching Pace", icon: "⏱️" },
  { value: "clarity", label: "💡 Concept Clarity", icon: "💡" },
  { value: "resources", label: "📖 Study Resources", icon: "📖" },
  { value: "assessment", label: "📝 Assessment", icon: "📝" },
  { value: "doubt", label: "❓ Doubt Resolution", icon: "❓" },
  { value: "other", label: "📋 Other", icon: "📋" },
];

const RATING_OPTIONS = [
  { value: 5, label: "Excellent", emoji: "😍", color: "#10b981" },
  { value: 4, label: "Good", emoji: "😊", color: "#3b82f6" },
  { value: 3, label: "Average", emoji: "😐", color: "#f59e0b" },
  { value: 2, label: "Poor", emoji: "😟", color: "#ef4444" },
  { value: 1, label: "Very Poor", emoji: "😢", color: "#dc2626" },
];

const SubjectFeedback = () => {
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [myStudent, setMyStudent] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [suggestions, setSuggestions] = useState("");
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

    const unsubFeedbacks = listenCollection("subjectFeedback", (data) => {
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
    if (!subject || !feedbackType || !rating || !feedback) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const feedbackRef = ref(db, "subjectFeedback");
      const newFeedbackRef = push(feedbackRef);

      const feedbackData = {
        id: newFeedbackRef.key,
        subject,
        teacher: teacher || "Not specified",
        feedbackType,
        rating,
        feedback,
        suggestions: suggestions || "",
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
      setSubject("");
      setTeacher("");
      setFeedbackType("");
      setRating(0);
      setFeedback("");
      setSuggestions("");
      setAnonymous(false);
      
      alert("✅ Feedback submitted successfully! Thank you for your input.");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("❌ Error submitting feedback: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (ratingValue) => {
    const ratingOption = RATING_OPTIONS.find(r => r.value === ratingValue);
    return ratingOption?.color || "#9ca3af";
  };

  const getRatingLabel = (ratingValue) => {
    const ratingOption = RATING_OPTIONS.find(r => r.value === ratingValue);
    return ratingOption ? `${ratingOption.emoji} ${ratingOption.label}` : "Not rated";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-600 mb-2">📚 Subject Feedback</h1>
      <p className="text-gray-600 mb-6">Share your feedback about subjects, teaching methods, and course content</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Feedback Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Submit Subject Feedback</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subject Name *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Mathematics, Physics, English"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Teacher Name (Optional)</label>
              <input
                type="text"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="Teacher's name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Feedback Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {FEEDBACK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFeedbackType(type.value)}
                    className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                      feedbackType === type.value
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-purple-300"
                    }`}
                  >
                    <span className="mr-2">{type.icon}</span>
                    {type.label.replace(/^.+ /, "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Overall Rating *</label>
              <div className="flex gap-2">
                {RATING_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    className={`flex-1 py-3 px-2 rounded-lg border-2 transition text-center ${
                      rating === r.value
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-300 bg-white hover:border-purple-300"
                    }`}
                    style={{
                      borderColor: rating === r.value ? r.color : undefined,
                      backgroundColor: rating === r.value ? r.color + "20" : undefined,
                    }}
                  >
                    <div className="text-2xl mb-1">{r.emoji}</div>
                    <div className="text-xs font-semibold">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Feedback *</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your thoughts about the subject, teaching method, or any concerns..."
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                required
              />
            </div>

            {/* Suggestions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Suggestions for Improvement</label>
              <textarea
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                placeholder="Any suggestions to make the subject better..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              />
            </div>

            {/* Anonymous */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous-subject"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <label htmlFor="anonymous-subject" className="text-sm text-gray-700">
                Submit anonymously
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
              feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="border-2 rounded-lg p-4 hover:shadow-md transition"
                  style={{ borderColor: getRatingColor(fb.rating) + "40" }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {FEEDBACK_TYPES.find(t => t.value === fb.feedbackType)?.icon || "📋"}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-800">{fb.subject}</h3>
                        <p className="text-xs text-gray-500">
                          {fb.studentName} • {fb.studentClass}
                          {fb.classArm ? ` - ${fb.classArm}` : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: getRatingColor(fb.rating) + "20",
                        color: getRatingColor(fb.rating),
                      }}
                    >
                      {getRatingLabel(fb.rating)}
                    </div>
                  </div>
                  
                  {fb.teacher && (
                    <p className="text-xs text-gray-600 mb-2">👨‍🏫 Teacher: {fb.teacher}</p>
                  )}
                  
                  <p className="text-sm text-gray-700 mb-2">{fb.feedback}</p>
                  
                  {fb.suggestions && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
                      <p className="text-xs text-blue-800">
                        <strong>Suggestion:</strong> {fb.suggestions}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>📋 {FEEDBACK_TYPES.find(t => t.value === fb.feedbackType)?.label.replace(/^.+ /, "")}</span>
                    <span>•</span>
                    <span>📅 {new Date(fb.createdAt).toLocaleDateString()}</span>
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

export default SubjectFeedback;
