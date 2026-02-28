import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const TIMETABLE_PATH = "timetable";
const CLASSES_PATH = "classes";

const PREDEFINED_CLASSES = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = [
  "08:00 - 08:45",
  "08:45 - 09:30",
  "09:30 - 10:15",
  "10:15 - 11:00",
  "11:00 - 11:15", // Break
  "11:15 - 12:00",
  "12:00 - 12:45",
  "12:45 - 01:30",
  "01:30 - 02:15",
];

const ManageTimetable = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [timetableData, setTimetableData] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState({
    day: "",
    timeSlot: "",
    subject: "",
    teacher: "",
    room: "",
  });

  useEffect(() => {
    const unsubClasses = listenCollection(CLASSES_PATH, setClasses);
    return () => unsubClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      const path = `${TIMETABLE_PATH}/${selectedClass}_${selectedSection}`;
      const unsubTimetable = listenCollection(path, setTimetableData);
      return () => unsubTimetable();
    }
  }, [selectedClass, selectedSection]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSection) {
      alert("Please select a class and section first!");
      return;
    }

    const path = `${TIMETABLE_PATH}/${selectedClass}_${selectedSection}`;
    
    try {
      if (editingEntry) {
        await updateRecord(path, editingEntry.id, form);
        alert("✅ Timetable entry updated!");
      } else {
        await addRecord(path, { ...form, class: selectedClass, section: selectedSection });
        alert("✅ Timetable entry added!");
      }
      resetForm();
    } catch (error) {
      alert("❌ Error: " + error.message);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      day: entry.day,
      timeSlot: entry.timeSlot,
      subject: entry.subject,
      teacher: entry.teacher || "",
      room: entry.room || "",
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this timetable entry?")) return;
    
    const path = `${TIMETABLE_PATH}/${selectedClass}_${selectedSection}`;
    try {
      await deleteRecord(path, id);
      alert("✅ Entry deleted!");
    } catch (error) {
      alert("❌ Error: " + error.message);
    }
  };

  const resetForm = () => {
    setForm({ day: "", timeSlot: "", subject: "", teacher: "", room: "" });
    setEditingEntry(null);
    setShowAddModal(false);
  };

  const getTimetableGrid = () => {
    const grid = {};
    DAYS.forEach(day => {
      grid[day] = {};
      TIME_SLOTS.forEach(slot => {
        grid[day][slot] = null;
      });
    });

    timetableData.forEach(entry => {
      if (grid[entry.day] && grid[entry.day][entry.timeSlot] !== undefined) {
        grid[entry.day][entry.timeSlot] = entry;
      }
    });

    return grid;
  };

  const grid = getTimetableGrid();

  // Get unique sections for selected class
  const getSections = () => {
    // This would ideally come from classArms collection
    // For now, return common sections
    return ["A", "B", "C", "D"];
  };

  // Combine database classes with predefined classes
  const allClasses = [...new Set([
    ...classes.map(c => c.name),
    ...PREDEFINED_CLASSES
  ])].sort((a, b) => {
    // Custom sort to maintain proper order
    const order = PREDEFINED_CLASSES;
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div style={{ maxWidth: "1400px", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
          📅 Manage Timetable
        </h2>
        <p style={{ color: "#9ca3af", fontSize: "13px" }}>
          Create and manage class timetables
        </p>
      </div>

      {/* Class and Section Selection */}
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        marginBottom: "24px"
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={labelStyle}>Select Class <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection("");
              }}
              style={inputStyle}
            >
              <option value="">-- Select Class --</option>
              {allClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={labelStyle}>Select Section <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedClass}
              style={inputStyle}
            >
              <option value="">-- Select Section --</option>
              {getSections().map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            disabled={!selectedClass || !selectedSection}
            style={{
              ...btnStyle("#6d28d9"),
              opacity: (!selectedClass || !selectedSection) ? 0.5 : 1,
              cursor: (!selectedClass || !selectedSection) ? "not-allowed" : "pointer"
            }}
          >
            ➕ Add Entry
          </button>
        </div>
      </div>

      {/* Timetable Grid */}
      {selectedClass && selectedSection ? (
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          overflow: "hidden"
        }}>
          <div style={{
            background: "#6d28d9",
            color: "#fff",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
              Timetable: {selectedClass} - Section {selectedSection}
            </h3>
            <span style={{ fontSize: "13px", opacity: 0.9 }}>
              {timetableData.length} entries
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ ...thStyle, width: "120px", position: "sticky", left: 0, background: "#f9fafb", zIndex: 10 }}>
                    Time / Day
                  </th>
                  {DAYS.map(day => (
                    <th key={day} style={thStyle}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{
                      ...tdStyle,
                      fontWeight: 600,
                      background: slot.includes("11:00 - 11:15") ? "#fef3c7" : "#f9fafb",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      fontSize: "12px"
                    }}>
                      {slot}
                      {slot.includes("11:00 - 11:15") && (
                        <div style={{ fontSize: "10px", color: "#92400e", marginTop: "2px" }}>
                          ☕ Break
                        </div>
                      )}
                    </td>
                    {DAYS.map(day => {
                      const entry = grid[day][slot];
                      const isBreak = slot.includes("11:00 - 11:15");
                      
                      return (
                        <td
                          key={day}
                          style={{
                            ...tdStyle,
                            background: isBreak ? "#fef3c7" : (entry ? "#f0fdf4" : "#fff"),
                            cursor: entry ? "pointer" : "default",
                            verticalAlign: "top",
                            padding: "8px"
                          }}
                          onClick={() => entry && handleEdit(entry)}
                        >
                          {isBreak ? (
                            <div style={{ textAlign: "center", color: "#92400e", fontSize: "12px" }}>
                              Break Time
                            </div>
                          ) : entry ? (
                            <div>
                              <div style={{ fontWeight: 700, color: "#065f46", fontSize: "13px", marginBottom: "4px" }}>
                                {entry.subject}
                              </div>
                              {entry.teacher && (
                                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "2px" }}>
                                  👨‍🏫 {entry.teacher}
                                </div>
                              )}
                              {entry.room && (
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                  🚪 {entry.room}
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.id);
                                }}
                                style={{
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "2px 8px",
                                  fontSize: "10px",
                                  marginTop: "4px",
                                  cursor: "pointer"
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", color: "#d1d5db", fontSize: "12px" }}>
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "60px 20px",
          textAlign: "center",
          color: "#9ca3af",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
            Select a Class and Section
          </p>
          <p style={{ fontSize: "14px" }}>
            Choose a class and section from the dropdowns above to view or create timetable
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <div style={{
              background: "#6d28d9",
              color: "#fff",
              padding: "20px 24px",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px"
            }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                {editingEntry ? "✏️ Edit Entry" : "➕ Add Timetable Entry"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Day <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    required
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">-- Select Day --</option>
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Time Slot <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    required
                    value={form.timeSlot}
                    onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">-- Select Time Slot --</option>
                    {TIME_SLOTS.filter(slot => !slot.includes("11:00 - 11:15")).map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Subject <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Teacher Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. John Doe"
                    value={form.teacher}
                    onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 101"
                    value={form.room}
                    onChange={(e) => setForm({ ...form, room: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="submit" style={{ ...btnStyle("#6d28d9"), flex: 1 }}>
                  {editingEntry ? "Update Entry" : "Add Entry"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ ...btnStyle("#6b7280"), flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "6px"
};

const inputStyle = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  outline: "none",
  background: "#fff"
};

const thStyle = {
  textAlign: "center",
  padding: "12px 8px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderRight: "1px solid #e5e7eb"
};

const tdStyle = {
  padding: "12px 8px",
  fontSize: "13px",
  color: "#374151",
  borderRight: "1px solid #e5e7eb",
  minHeight: "80px"
};

const btnStyle = (color) => ({
  background: color,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer"
});

export default ManageTimetable;
