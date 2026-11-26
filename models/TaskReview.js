import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Review cycles (round 46): one document per Submit / Resubmit of a task. Rules in
// lib/tasks/reviews.js; written ONLY by app/(app)/projects/review-actions.js and
// the status-change action (withdraw). Deleted with the task.
//   status   open      — waiting for verdicts (task at รอตรวจ / รอตรวจสอบ)
//            revision  — closed, at least one section ไม่ผ่าน (task → แก้ไข)
//            passed    — closed, every section ผ่าน (task → เสร็จสมบูรณ์)
//            withdrawn — closed because the status left review by an escape
//                        hatch ("ยกเลิกการส่งตรวจ")
const SectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // present | video | design
    reviewerId: { type: ObjectId, ref: "User", default: null },
    verdict: { type: String, enum: ["pending", "pass", "fail"], default: "pending" },
    feedback: { type: String, default: "" },
    decidedBy: { type: ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    onBehalf: { type: Boolean, default: false }, // decided by Manager / superadmin for the reviewer
    carriedOver: { type: Boolean, default: false }, // a pass kept from the previous cycle
    assignedAt: { type: Date, default: null },
  },
  { _id: false }
);

const TaskReviewSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: "Task", required: true },
    project: { type: ObjectId, ref: "Project", required: true },
    cycleNo: { type: Number, required: true, min: 1 },
    link: { type: String, required: true }, // ลิงก์รีวิว
    note: { type: String, default: "" },
    resubmit: { type: Boolean, default: false },
    linkUpdated: { type: Boolean, default: false }, // resubmit with a different link
    submittedBy: { type: ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, required: true },
    status: { type: String, enum: ["open", "revision", "passed", "withdrawn"], default: "open" },
    closedAt: { type: Date, default: null },
    closedBy: { type: ObjectId, ref: "User", default: null }, // withdrawn: who moved the status
    sections: { type: [SectionSchema], default: [] },
  },
  { collection: "task_reviews", minimize: false }
);

TaskReviewSchema.index({ task: 1, cycleNo: 1 }, { unique: true });

const TaskReview = mongoose.models.TaskReview || mongoose.model("TaskReview", TaskReviewSchema);

export default TaskReview;
