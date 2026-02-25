import { useEffect, useRef } from "react";
import { listenRegisteredStudents, sendTelegramMessage } from "../firebase";
import { messageQueue } from "../utils/messageQueue";

// 📅 Sample Class Schedule
const CLASS_SCHEDULE = [
  { name: "Mathematics",      time: "09:00" },
  { name: "Physics",          time: "11:00" },
  { name: "Computer Science", time: "14:00" },
  { name: "English",          time: "16:00" },
];

const TelegramBotService = () => {
  const sentReminders = useRef({}); // { 'YYYY-MM-DD-Mathematics': true }
  const studentsRef   = useRef([]);

  useEffect(() => {
    // 🔹 Sync students list
    const unsub = listenRegisteredStudents((s) => {
      studentsRef.current = s;
    });

    // 🔹 Main background loop — check every 5 s
    const pollInterval = setInterval(checkAndSendReminders, 5000);

    return () => {
      unsub();
      clearInterval(pollInterval);
    };
  }, []);

  const checkAndSendReminders = () => {
    const now      = new Date();
    const todayStr = now.toISOString().split("T")[0];

    CLASS_SCHEDULE.forEach((cls) => {
      const [h, m]   = cls.time.split(":");
      const classTime = new Date();
      classTime.setHours(Number(h), Number(m), 0, 0);

      const diffMins  = Math.round((classTime - now) / 60_000);
      const key       = `${todayStr}-${cls.name}`;

      // ⏰ Trigger once per class when 28–32 minutes remain
      if (diffMins >= 28 && diffMins <= 32 && !sentReminders.current[key]) {
        sentReminders.current[key] = true;
        console.info(`[BotService] 🚀 Queuing reminders for ${cls.name}`);

        const msg =
          `⏰ *Upcoming Class Reminder*\n\n` +
          `Your *${cls.name}* class starts in 30 minutes (${cls.time}).\n\n` +
          `Don't forget to attend and mark your presence!`;

        // 🧵 Enqueue each student message instead of firing all at once
        for (const student of studentsRef.current) {
          if (student.telegramChatId) {
            messageQueue.enqueue(
              () => sendTelegramMessage(student.telegramChatId, msg),
              `reminder:${cls.name}:${student.rollNumber}`
            );
          }
        }
      }
    });
  };

  return null; // Headless component
};

export default TelegramBotService;
