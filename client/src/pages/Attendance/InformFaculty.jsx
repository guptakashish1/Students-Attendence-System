import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { listenRegisteredStudents } from "../../firebase";
import emailjs from "@emailjs/browser";

const InformFaculty = () => {
    const [searchParams] = useSearchParams();
    const rollNumber = searchParams.get("rollNumber");
    const date = searchParams.get("date");

    const [student, setStudent] = useState(null);
    const [emailDraft, setEmailDraft] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const unsub = listenRegisteredStudents((students) => {
            const found = students.find((s) => s.rollNumber === rollNumber);
            if (found) {
                setStudent(found);
                generateDraft(found);
            }
        });
        return () => unsub();
    }, [rollNumber, date]);

    const generateDraft = (s) => {
        const draft = `Subject: Notification regarding consecutive absences - ${s.name} (${s.rollNumber})\n\n` +
            `Dear Faculty Member,\n\n` +
            `I am writing to inform you that my child, ${s.name}, student of class ${s.studentClass} (Roll No: ${s.rollNumber}), has been absent for the past three days (concluding on ${date}).\n\n` +
            `We apologize for the inconvenience and are working to ensure their return as soon as possible. Please let us know if there is any academic work they need to catch up on.\n\n` +
            `Sincerely,\n` +
            `Guardian of ${s.name}`;
        setEmailDraft(draft);
    };

    const sendEmail = async () => {
        setLoading(true);
        try {
            // ✅ Use EmailJS to send the faculty email
            // Note: Reusing the same service/template IDs for demonstration
            await emailjs.send(
                "service_vttuby8",     // SERVICE_ID
                "template_82n04ia",    // TEMPLATE_ID
                {
                    to_name: "Faculty Member",
                    from_name: student.name,
                    message: emailDraft,
                    student_roll: student.rollNumber,
                    parent_email: student.parentEmail,
                },
                "G44L9uQJ5-q8l-F6-"    // PUBLIC_KEY
            );
            setSent(true);
            alert("✅ Email sent to faculty successfully!");
        } catch (error) {
            console.error("Email Error:", error);
            alert("❌ Failed to send email. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    if (!student) return <div className="p-10 text-center text-gray-400">Loading student details...</div>;

    return (
        <div className="p-8 max-w-3xl mx-auto bg-white shadow-2xl rounded-3xl mt-10 border border-purple-50">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-800">Smart AI Absence Workflow</h2>
                    <p className="text-purple-600 font-medium italic">Empowered by Automation logic</p>
                </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-2xl mb-8 border border-purple-100">
                <h3 className="text-lg font-bold text-purple-900 mb-2">3-Day Consecutive Absence Detected</h3>
                <p className="text-purple-800 opacity-80">
                    Our AI has detected that <b>{student.name}</b> has been absent for 3 consecutive days.
                    We have generated a polite email draft for your faculty below.
                </p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-wider">AI-Generated Email Draft</label>
                    <textarea
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        className="w-full h-64 p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-400 focus:bg-white outline-none transition-all text-gray-700 leading-relaxed font-serif"
                        disabled={loading || sent}
                    />
                </div>

                {!sent ? (
                    <button
                        onClick={sendEmail}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? "Sending AI Notification..." : "🚀 Confirm & Auto-Send to Faculty"}
                    </button>
                ) : (
                    <div className="p-6 bg-green-100 text-green-800 rounded-2xl text-center font-bold flex items-center justify-center gap-3">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Email has been automatically sent to the faculty office!
                    </div>
                )}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Business Logic</span>
                    <span className="text-gray-600 font-medium">Auto-Triggered Workflow</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <span className="block text-xs text-gray-400 uppercase font-bold mb-1">AI Intelligence</span>
                    <span className="text-gray-600 font-medium">Polite Tone Generation</span>
                </div>
            </div>
        </div>
    );
};

export default InformFaculty;
