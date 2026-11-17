import mongoose from "mongoose";
import { PLATFORM_MARK_KEYS, TASK_OPTION_LABEL_MAX, TASK_OPTION_LIST_KEYS } from "../lib/tasks/options.js";

const { ObjectId } = mongoose.Schema.Types;

// One admin-managed choice in a task option list (Video Type, Platform, …).
// Tasks store the option's _id (details.videoType / details.platforms). Inactive
// options are hidden from pickers but still render on tasks that use them; an
// option referenced by any task can't be deleted (deactivate it instead).
const TaskOptionSchema = new mongoose.Schema(
  {
    list: { type: String, enum: TASK_OPTION_LIST_KEYS, required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: TASK_OPTION_LABEL_MAX },
    // Platform list only: a PLATFORM_MARKS key (rendered by components/tasks/PlatformIcon.jsx).
    icon: { type: String, enum: [...PLATFORM_MARK_KEYS, null], default: null },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "task_options" }
);

TaskOptionSchema.index({ list: 1, label: 1 }, { unique: true });
TaskOptionSchema.index({ list: 1, order: 1 });

const TaskOption = mongoose.models.TaskOption || mongoose.model("TaskOption", TaskOptionSchema);

export default TaskOption;
