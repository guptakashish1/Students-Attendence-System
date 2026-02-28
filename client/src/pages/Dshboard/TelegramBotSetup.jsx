import React, { useState } from "react";

const TelegramBotSetup = () => {
    const [activeTab, setActiveTab] = useState("overview");

    const webhookCode = `// server.js - Express Webhook Handler
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

const app = express();
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: 'https://your-project.firebaseio.com'
});

const db = admin.database();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

// Webhook endpoint
app.post('/webhook/telegram', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text?.trim();
    const userId = message.from.id;

    // Authenticate user
    const user = await authenticateUser(chatId);
    if (!user) {
      await sendMessage(chatId, "⚠️ You are not registered. Please contact admin.");
      return res.sendStatus(200);
    }

    // Handle commands based on role
    await handleCommand(text, chatId, user);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Authenticate user and get role
async function authenticateUser(chatId) {
  const studentsRef = db.ref('students');
  const snapshot = await studentsRef.orderByChild('telegramChatId').equalTo(chatId.toString()).once('value');
  
  if (snapshot.exists()) {
    const studentData = Object.values(snapshot.val())[0];
    return { ...studentData, role: 'student' };
  }

  // Check if admin
  const adminsRef = db.ref('admins');
  const adminSnapshot = await adminsRef.orderByChild('telegramChatId').equalTo(chatId.toString()).once('value');
  
  if (adminSnapshot.exists()) {
    const adminData = Object.values(adminSnapshot.val())[0];
    return { ...adminData, role: 'admin' };
  }

  // Check if parent
  const parentsRef = db.ref('students');
  const parentSnapshot = await parentsRef.orderByChild('parentTelegramChatId').equalTo(chatId.toString()).once('value');
  
  if (parentSnapshot.exists()) {
    const parentData = Object.values(parentSnapshot.val())[0];
    return { ...parentData, role: 'parent', childRollNumber: parentData.rollNumber };
  }

  return null;
}

// Command handler
async function handleCommand(text, chatId, user) {
  if (!text || !text.startsWith('/')) return;

  const [command, ...args] = text.split(' ');

  switch (command) {
    case '/start':
      await sendWelcomeMessage(chatId, user);
      break;

    case '/attendance':
      await sendTodayAttendance(chatId, user);
      break;

    case '/percentage':
      await sendAttendancePercentage(chatId, user);
      break;

    case '/report':
      await sendDetailedReport(chatId, user);
      break;

    case '/export':
      if (user.role === 'admin') {
        const className = args.join(' ');
        await exportAttendancePDF(chatId, className);
      } else {
        await sendMessage(chatId, "⛔ Admin access required.");
      }
      break;

    case '/alerts':
      await sendLowAttendanceAlerts(chatId, user);
      break;

    case '/help':
      await sendHelpMessage(chatId, user);
      break;

    default:
      await sendMessage(chatId, "❓ Unknown command. Type /help for available commands.");
  }
}

// Send today's attendance
async function sendTodayAttendance(chatId, user) {
  const today = new Date().toISOString().split('T')[0];
  const rollNumber = user.role === 'parent' ? user.childRollNumber : user.rollNumber;
  
  const attRef = db.ref(\`attendance/\${today}/\${rollNumber}\`);
  const snapshot = await attRef.once('value');
  
  const status = snapshot.exists() ? snapshot.val().status : 'Not marked';
  const emoji = status === 'IN' ? '✅' : status === 'ABSENT' ? '❌' : '📌';
  
  await sendMessage(chatId, 
    \`📅 *Today's Attendance* (\${today})\\n\\n\` +
    \`Student: *\${user.name}*\\n\` +
    \`Status: \${emoji} *\${status}*\`
  );
}

// Calculate and send attendance percentage
async function sendAttendancePercentage(chatId, user) {
  const rollNumber = user.role === 'parent' ? user.childRollNumber : user.rollNumber;
  const percentage = await calculateAttendancePercentage(rollNumber);
  
  let message = \`📊 *Attendance Report*\\n\\n\`;
  message += \`Student: *\${user.name}*\\n\`;
  message += \`Overall: *\${percentage.toFixed(2)}%*\\n\\n\`;
  
  // AI Smart Alert (Premium Feature)
  if (percentage < 75) {
    const required = Math.ceil((75 * percentage.total - 100 * percentage.present) / 25);
    message += \`⚠️ *Warning:* Your attendance is below 75%!\\n\`;
    message += \`💡 You need *\${required} more classes* to reach 75%\\n\\n\`;
    message += \`💎 *AI Insight:* Attend next \${required} classes without fail.\`;
  } else if (percentage >= 75 && percentage < 85) {
    message += \`✅ Good! You're above the minimum requirement.\\n\`;
    message += \`💡 Try to maintain above 80% for better records.\`;
  } else {
    message += \`🌟 Excellent! Keep up the great work!\`;
  }
  
  await sendMessage(chatId, message);
}

// Calculate attendance percentage
async function calculateAttendancePercentage(rollNumber) {
  const attRef = db.ref('attendance');
  const snapshot = await attRef.once('value');
  
  let present = 0, total = 0;
  
  if (snapshot.exists()) {
    const dates = snapshot.val();
    for (const date in dates) {
      if (dates[date][rollNumber]) {
        total++;
        if (dates[date][rollNumber].status === 'IN') {
          present++;
        }
      }
    }
  }
  
  return { 
    percentage: total > 0 ? (present / total) * 100 : 0,
    present,
    total
  };
}

// Export attendance as PDF (Admin only)
async function exportAttendancePDF(chatId, className) {
  try {
    await sendMessage(chatId, \`⏳ Generating PDF for *\${className}*...\`);
    
    // Fetch students and attendance data
    const studentsRef = db.ref('students');
    const studentsSnapshot = await studentsRef.orderByChild('studentClass').equalTo(className).once('value');
    
    if (!studentsSnapshot.exists()) {
      await sendMessage(chatId, \`❌ No students found in class *\${className}*\`);
      return;
    }
    
    const students = Object.values(studentsSnapshot.val());
    const attRef = db.ref('attendance');
    const attSnapshot = await attRef.once('value');
    const attendanceData = attSnapshot.val() || {};
    
    // Generate PDF
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(\`Attendance Report - \${className}\`, 14, 20);
    doc.setFontSize(10);
    doc.text(\`Generated: \${new Date().toLocaleString()}\`, 14, 28);
    
    const tableData = students.map(student => {
      const stats = calculateStudentStats(student.rollNumber, attendanceData);
      return [
        student.rollNumber,
        student.name,
        stats.present,
        stats.total,
        \`\${stats.percentage.toFixed(1)}%\`
      ];
    });
    
    doc.autoTable({
      startY: 35,
      head: [['Roll No', 'Name', 'Present', 'Total', 'Percentage']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [109, 40, 217] }
    });
    
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    // Send PDF via Telegram
    await sendDocument(chatId, pdfBuffer, \`Attendance_\${className}_\${Date.now()}.pdf\`);
    await sendMessage(chatId, \`✅ PDF generated successfully!\`);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    await sendMessage(chatId, \`❌ Error generating PDF: \${error.message}\`);
  }
}

function calculateStudentStats(rollNumber, attendanceData) {
  let present = 0, total = 0;
  
  for (const date in attendanceData) {
    if (attendanceData[date][rollNumber]) {
      total++;
      if (attendanceData[date][rollNumber].status === 'IN') {
        present++;
      }
    }
  }
  
  return {
    present,
    total,
    percentage: total > 0 ? (present / total) * 100 : 0
  };
}

// Send low attendance alerts
async function sendLowAttendanceAlerts(chatId, user) {
  const rollNumber = user.role === 'parent' ? user.childRollNumber : user.rollNumber;
  const { percentage, present, total } = await calculateAttendancePercentage(rollNumber);
  
  if (percentage < 75) {
    const required = Math.ceil((75 * total - 100 * present) / 25);
    await sendMessage(chatId,
      \`🚨 *Low Attendance Alert*\\n\\n\` +
      \`Current: *\${percentage.toFixed(2)}%*\\n\` +
      \`Present: \${present}/\${total} classes\\n\\n\` +
      \`⚠️ *Action Required:*\\n\` +
      \`You need *\${required} more classes* to reach 75%\\n\\n\` +
      \`💎 *AI Recommendation:*\\n\` +
      \`• Attend all upcoming classes\\n\` +
      \`• Avoid any further absences\\n\` +
      \`• Contact faculty if you have concerns\`
    );
  } else {
    await sendMessage(chatId, \`✅ Your attendance is healthy at *\${percentage.toFixed(2)}%*\`);
  }
}

// Send help message
async function sendHelpMessage(chatId, user) {
  let message = \`📚 *Available Commands*\\n\\n\`;
  
  message += \`/attendance - Check today's status\\n\`;
  message += \`/percentage - View overall percentage\\n\`;
  message += \`/report - Get detailed report\\n\`;
  message += \`/alerts - Check low attendance alerts\\n\`;
  message += \`/help - Show this message\\n\`;
  
  if (user.role === 'admin') {
    message += \`\\n🔐 *Admin Commands:*\\n\`;
    message += \`/export [class] - Export PDF report\\n\`;
    message += \`Example: /export Class IX\`;
  }
  
  await sendMessage(chatId, message);
}

// Send welcome message
async function sendWelcomeMessage(chatId, user) {
  const roleEmoji = user.role === 'admin' ? '👨‍💼' : user.role === 'parent' ? '👨‍👩‍👦' : '👨‍🎓';
  
  await sendMessage(chatId,
    \`\${roleEmoji} *Welcome to Attendance Bot!*\\n\\n\` +
    \`Name: *\${user.name}*\\n\` +
    \`Role: *\${user.role.toUpperCase()}*\\n\\n\` +
    \`Type /help to see available commands.\`
  );
}

// Send Telegram message
async function sendMessage(chatId, text) {
  const url = \`https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendMessage\`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

// Send document
async function sendDocument(chatId, buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', buffer, filename);
  
  const url = \`https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendDocument\`;
  await fetch(url, {
    method: 'POST',
    body: form
  });
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(\`Webhook server running on port \${PORT}\`);
});`;

    const envCode = `# .env file
TELEGRAM_BOT_TOKEN=your_bot_token_here
JWT_SECRET=your_jwt_secret_here
PORT=3001
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com`;

    const setupSteps = `# Telegram Bot Setup Guide

## 1. Create Telegram Bot
1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Follow instructions to create your bot
4. Copy the bot token

## 2. Set Webhook
\`\`\`bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
\`\`\`

## 3. Deploy Webhook Server
- Deploy the webhook code to a server (Heroku, AWS, etc.)
- Ensure HTTPS is enabled
- Set environment variables

## 4. Store Telegram IDs
- Students register via /start command
- System stores chatId in Firebase
- Role-based access automatically configured

## 5. Test Commands
- /start - Register user
- /attendance - Check today
- /percentage - View stats
- /export Class IX - Generate PDF (Admin only)`;

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                🤖 Advanced Telegram Bot Setup
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Complete webhook-based bot with JWT auth, role-based access, and AI features
            </p>

            {/* Features Grid */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
                gap: "16px", 
                marginBottom: "24px" 
            }}>
                {[
                    { icon: "🔐", title: "JWT Authentication", desc: "Secure token-based auth", color: "#6d28d9" },
                    { icon: "👥", title: "Role-Based Access", desc: "Admin / Student / Parent", color: "#3b82f6" },
                    { icon: "🌐", title: "Webhook System", desc: "Real-time, no polling", color: "#10b981" },
                    { icon: "💎", title: "AI Smart Alerts", desc: "Predictive attendance warnings", color: "#f59e0b" },
                    { icon: "📄", title: "PDF Export", desc: "Generate reports via bot", color: "#ef4444" },
                    { icon: "📊", title: "Auto Notifications", desc: "Instant attendance updates", color: "#8b5cf6" }
                ].map((feature, i) => (
                    <div
                        key={i}
                        style={{
                            background: "#fff",
                            borderRadius: "12px",
                            padding: "20px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                            borderLeft: `4px solid ${feature.color}`
                        }}
                    >
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>{feature.icon}</div>
                        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>
                            {feature.title}
                        </h3>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                            {feature.desc}
                        </p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
                    {[
                        { id: "overview", label: "📖 Overview" },
                        { id: "webhook", label: "🌐 Webhook Code" },
                        { id: "env", label: "⚙️ Environment" },
                        { id: "setup", label: "🚀 Setup Guide" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: "16px",
                                border: "none",
                                background: activeTab === tab.id ? "#f5f3ff" : "transparent",
                                color: activeTab === tab.id ? "#6d28d9" : "#6b7280",
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                fontSize: "14px",
                                cursor: "pointer",
                                borderBottom: activeTab === tab.id ? "2px solid #6d28d9" : "none"
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ padding: "24px" }}>
                    {activeTab === "overview" && (
                        <div>
                            <h3 style={{ fontSize: "18px", fontWeight: 700, marginTop: 0 }}>
                                🎯 Bot Features
                            </h3>
                            
                            <div style={{ marginBottom: "24px" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#6d28d9", marginBottom: "12px" }}>
                                    💎 AI Smart Alerts (Premium Feature)
                                </h4>
                                <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "8px", padding: "16px" }}>
                                    <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
                                        <strong>Example:</strong> If attendance drops below 75%:
                                    </p>
                                    <div style={{ 
                                        background: "#fff", 
                                        borderRadius: "6px", 
                                        padding: "12px", 
                                        marginTop: "8px",
                                        fontFamily: "monospace",
                                        fontSize: "12px"
                                    }}>
                                        ⚠️ Warning: Your attendance is 63%.<br/>
                                        You need 6 more classes to reach 75%
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#3b82f6", marginBottom: "12px" }}>
                                    📄 Export PDF via Telegram
                                </h4>
                                <div style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: "8px", padding: "16px" }}>
                                    <p style={{ margin: 0, fontSize: "13px", color: "#1e40af" }}>
                                        Admin types: <code style={{ background: "#fff", padding: "2px 6px", borderRadius: "4px" }}>/export Class IX</code>
                                    </p>
                                    <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#1e40af" }}>
                                        Bot sends PDF file with complete attendance report
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#10b981", marginBottom: "12px" }}>
                                    👥 Role-Based Commands
                                </h4>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "#f9fafb" }}>
                                            <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
                                                Command
                                            </th>
                                            <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
                                                Access
                                            </th>
                                            <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
                                                Description
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { cmd: "/attendance", role: "All", desc: "Check today's attendance" },
                                            { cmd: "/percentage", role: "All", desc: "View attendance percentage" },
                                            { cmd: "/report", role: "All", desc: "Detailed attendance report" },
                                            { cmd: "/alerts", role: "All", desc: "Low attendance warnings" },
                                            { cmd: "/export [class]", role: "Admin", desc: "Export PDF report" },
                                            { cmd: "/broadcast", role: "Admin", desc: "Send mass notifications" }
                                        ].map((item, i) => (
                                            <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                                                <td style={{ padding: "12px", fontSize: "13px", fontFamily: "monospace", color: "#6d28d9" }}>
                                                    {item.cmd}
                                                </td>
                                                <td style={{ padding: "12px", fontSize: "12px" }}>
                                                    <span style={{
                                                        background: item.role === "Admin" ? "#fee2e2" : "#d1fae5",
                                                        color: item.role === "Admin" ? "#991b1b" : "#065f46",
                                                        padding: "2px 8px",
                                                        borderRadius: "4px",
                                                        fontWeight: 600
                                                    }}>
                                                        {item.role}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "12px", fontSize: "13px", color: "#374151" }}>
                                                    {item.desc}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "webhook" && (
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                                🌐 Webhook Server Code
                            </h3>
                            <pre style={{
                                background: "#1e293b",
                                color: "#e2e8f0",
                                padding: "20px",
                                borderRadius: "8px",
                                overflow: "auto",
                                fontSize: "12px",
                                lineHeight: "1.6"
                            }}>
                                {webhookCode}
                            </pre>
                        </div>
                    )}

                    {activeTab === "env" && (
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                                ⚙️ Environment Variables
                            </h3>
                            <pre style={{
                                background: "#1e293b",
                                color: "#e2e8f0",
                                padding: "20px",
                                borderRadius: "8px",
                                overflow: "auto",
                                fontSize: "12px",
                                lineHeight: "1.6"
                            }}>
                                {envCode}
                            </pre>
                        </div>
                    )}

                    {activeTab === "setup" && (
                        <div>
                            <pre style={{
                                background: "#1e293b",
                                color: "#e2e8f0",
                                padding: "20px",
                                borderRadius: "8px",
                                overflow: "auto",
                                fontSize: "12px",
                                lineHeight: "1.6",
                                whiteSpace: "pre-wrap"
                            }}>
                                {setupSteps}
                            </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* Implementation Notes */}
            <div style={{ 
                background: "#fff", 
                borderRadius: "12px", 
                padding: "24px", 
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                marginTop: "24px"
            }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                    📝 Implementation Notes
                </h3>
                <ul style={{ fontSize: "13px", color: "#374151", lineHeight: "1.8", paddingLeft: "20px" }}>
                    <li>Deploy webhook server on a platform with HTTPS support (Heroku, AWS, Vercel)</li>
                    <li>Store Telegram Chat IDs in Firebase when users send /start command</li>
                    <li>Use JWT tokens for secure authentication between services</li>
                    <li>Implement rate limiting to prevent abuse</li>
                    <li>Set up error logging and monitoring</li>
                    <li>Test all commands thoroughly before production deployment</li>
                    <li>Configure Firebase security rules for role-based access</li>
                    <li>Use environment variables for all sensitive data</li>
                </ul>
            </div>
        </div>
    );
};

export default TelegramBotSetup;
