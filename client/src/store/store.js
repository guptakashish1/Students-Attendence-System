// src/store/store.js
import { configureStore, createSlice } from "@reduxjs/toolkit";

const initialState = {
  students: [],
  alertBox: { title: "", message: "", color: "green", show: false },
};

const studentSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    addStudent: (state, action) => {
      state.students.push(action.payload);
    },
    setAlertBox: (state, action) => {
      state.alertBox = action.payload;
    },
  },
});

export const { addStudent, setAlertBox } = studentSlice.actions;

export const store = configureStore({
  reducer: {
    students: studentSlice.reducer,
  },
});
