// src/Utils/SendMails.jsx
import emailjs from "emailjs-com";

// ⚡ Replace with your EmailJS credentials
const SERVICE_ID = "your_service_id";
const TEMPLATE_ID_ABSENT = "your_absent_template_id";
const TEMPLATE_ID_LEAVE = "your_leave_template_id";
const USER_ID = "your_user_id"; // (sometimes called publicKey)

// --- Send Absent Email ---
export const sendAbsentMail = async (student) => {
  try {
    const templateParams = {
      to_email: student.fatherEmail, // must be in student data
      student_name: student.name,
      student_class: student.className,
      roll_number: student.rollNumber,
      message: `Dear Parent, your child ${student.name} (Class ${student.className}) was marked ABSENT today.`,
    };

    await emailjs.send(SERVICE_ID, TEMPLATE_ID_ABSENT, templateParams, USER_ID);
    console.log(`📧 Absent email sent for ${student.name}`);
  } catch (error) {
    console.error("❌ Failed to send absent email:", error);
  }
};

// --- Send Leave Email ---
export const sendLeaveMail = async (student) => {
  try {
    const templateParams = {
      to_email: student.fatherEmail,
      student_name: student.name,
      student_class: student.className,
      roll_number: student.rollNumber,
      message: `Dear Parent, your child ${student.name} (Class ${student.className}) has been marked on LEAVE today.`,
    };

    await emailjs.send(SERVICE_ID, TEMPLATE_ID_LEAVE, templateParams, USER_ID);
    console.log(`📧 Leave email sent for ${student.name}`);
  } catch (error) {
    console.error("❌ Failed to send leave email:", error);
  }
};
