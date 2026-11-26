import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Task activity log (Task Detail → Activity). Written ONLY by the task/content
// server actions via lib/tasks/activity.js, after the main write (never breaks it).
// Starts recording from round 33; older tasks have no back-filled history.
//   created          { duplicatedFrom? }           — a new task (or a duplicate)
//   status_changed   { from, to, auto? }            — status keys; `auto` (round 45):
//                    { productionId, productionTitle } = a System move (Clip
//                    source-ready, lib/tasks/sourceReady.js), actor null
//   updated          { fields: [label] }            — Edit with changes
//   assignee_changed { from, to }                   — user ids
//   reviewer_changed { role, from, to }             — role label + user ids
//   assets_changed   { added, removed }             — Post/Article related assets
//   people_changed   { role, added: [name], removed: [name] } — Production
//                    Videographers / Presenters (round 38; names stored)
// Deleted with the task (and with its content).
export const ACTIVITY_TYPES = [
  "created",
  "status_changed",
  "updated",
  "assignee_changed",
  "reviewer_changed",
  "assets_changed",
  "people_changed",
];

const TaskActivitySchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: "Task", required: true },
    project: { type: ObjectId, ref: "Project", required: true },
    // null = System (round 45: automatic moves); a user id otherwise.
    actor: { type: ObjectId, ref: "User", default: null },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "task_activities", minimize: false }
);

TaskActivitySchema.index({ task: 1, createdAt: -1 });

const TaskActivity = mongoose.models.TaskActivity || mongoose.model("TaskActivity", TaskActivitySchema);

export default TaskActivity;
