"use client";

// The All Tasks / My Workspace URL state on the client (round 58): the params from
// useSearchParams, the scope from the page path (never a URL param).

import { usePathname, useSearchParams } from "next/navigation";
import { parseAllTasks, scopeOfPath } from "@/lib/tasks/allTasksFilters";

export function useAllTasksState() {
  return parseAllTasks(useSearchParams(), scopeOfPath(usePathname()));
}
