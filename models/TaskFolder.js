import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A shared task folder (round 36; rules in lib/tasks/folders.js). Created with
// its Folder ID by the create-task action ("New Folder"); several tasks of the
// same project and suffix may link to it through Task.folderId. `name` and
// `location` are folder-level: every task in the folder shows and edits them.
// Existing tasks' folders are back-filled by scripts/migrate-task-folders.mjs.
const TaskFolderSchema = new mongoose.Schema(
  {
    folderId: { type: String, required: true, unique: true, immutable: true },
    suffix: { type: String, required: true, immutable: true },
    project: { type: ObjectId, ref: "Project", required: true, immutable: true },
    name: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    createdBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "task_folders" }
);

// Choose Folder list: this project's folders of one suffix, newest first.
TaskFolderSchema.index({ project: 1, suffix: 1, createdAt: -1 });

const TaskFolder = mongoose.models.TaskFolder || mongoose.model("TaskFolder", TaskFolderSchema);

export default TaskFolder;
