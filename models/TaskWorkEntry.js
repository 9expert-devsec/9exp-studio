import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Work Plan (round 47): one plan (intended time) or log (actual time) of ONE
// person on ONE task on ONE Bangkok calendar day. Rules: lib/tasks/workplan.js.
// Written ONLY by app/(app)/projects/workplan-actions.js; deleted with the task.
//   mode "range"  start / end "HH:mm" (end after start, same day); minutes = end − start
//   mode "hours"  minutes only (0.25 h steps), no position in the day
// A log attaches to the DATE, never to a plan. `movedFrom` (plans): the original
// date, kept from the FIRST move only.
const TaskWorkEntrySchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: "Task", required: true },
    project: { type: ObjectId, ref: "Project", required: true },
    person: { type: ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["plan", "log"], required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (Asia/Bangkok)
    mode: { type: String, enum: ["range", "hours"], required: true },
    start: { type: String, default: null },
    end: { type: String, default: null },
    minutes: { type: Number, required: true, min: 1, max: 1440 },
    note: { type: String, default: "" }, // logs: work note
    movedFrom: { type: String, default: null }, // plans
    onBehalf: { type: Boolean, default: false }, // written by Manager / superadmin for the person
    createdBy: { type: ObjectId, ref: "User", required: true },
    updatedBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "task_work_entries" }
);

TaskWorkEntrySchema.index({ task: 1, person: 1, kind: 1, date: 1 });
// Cross-task checks: one person's plans / logs on a day, on every task.
TaskWorkEntrySchema.index({ person: 1, kind: 1, date: 1 });

const TaskWorkEntry = mongoose.models.TaskWorkEntry || mongoose.model("TaskWorkEntry", TaskWorkEntrySchema);

export default TaskWorkEntry;
