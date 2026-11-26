import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Task Detail → Comments (round 46): a flat list per task. Soft delete
// (deletedAt) — the item stays in the list as "ความคิดเห็นถูกลบ". Written ONLY by
// app/(app)/projects/comment-actions.js; deleted with the task. No Activity entries.
export const COMMENT_MAX = 5000;

const TaskCommentSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: "Task", required: true },
    project: { type: ObjectId, ref: "Project", required: true },
    author: { type: ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: COMMENT_MAX },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "task_comments" }
);

TaskCommentSchema.index({ task: 1, createdAt: 1 });

const TaskComment = mongoose.models.TaskComment || mongoose.model("TaskComment", TaskCommentSchema);

export default TaskComment;
