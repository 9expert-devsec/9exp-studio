// Project progress / counts: ONE function the Task and Content rounds replace.
// No source yet → everything is 0.

/**
 * @param {object} _project
 * @returns {{ progress: number, files: number, tasks: { total: number, completed: number, inProgress: number, open: number } }}
 */
export function projectStats(_project) {
  return { progress: 0, files: 0, tasks: { total: 0, completed: 0, inProgress: 0, open: 0 } };
}
