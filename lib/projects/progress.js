// Project / content progress and counts: the functions the Task round replaces.
// No source yet → everything is 0.

/**
 * @param {object} _project
 * @returns {{ progress: number, files: number, tasks: { total: number, completed: number, inProgress: number, open: number } }}
 */
export function projectStats(_project) {
  return { progress: 0, files: 0, tasks: { total: 0, completed: 0, inProgress: 0, open: 0 } };
}

/**
 * Per content item. recentTasks: up to 3, shaped for <TaskCard>:
 *   { id, number, title, status, dueDate, createdBy: {name, avatarUrl}, assignee: {name, avatarUrl} | null }
 * @param {object} _content
 * @returns {{ total: number, completed: number, percent: number, recentTasks: object[] }}
 */
export function contentStats(_content) {
  return { total: 0, completed: 0, percent: 0, recentTasks: [] };
}
