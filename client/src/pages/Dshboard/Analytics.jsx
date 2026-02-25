import React, { useEffect, useState } from "react";
import { getAttendanceRangeStats } from "../../firebase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

const daysBack = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

export default function Analytics() {
  const [dailyStats, setDailyStats] = useState([]);   // last 7 days
  const [classStats, setClassStats] = useState([]);   // per-class today

  useEffect(() => {
    const start = daysBack(6);
    const end = daysBack(0);

    getAttendanceRangeStats(start, end).then(({ perDay, perClassToday }) => {
      setDailyStats(perDay);
      setClassStats(perClassToday);
    });
  }, []);

  return (
    <div className="space-y-10">
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">Last 7 Days – Present Count</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">Today – Present by Class</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="class" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="present" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
