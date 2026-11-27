// Status & Progress view (rounds 48–49) — pure (no DB, no React). For Production,
// Graphic, Photo, Article and Post it returns everything the Task Detail right
// panel draws:
//   steps    lib/tasks/stepper.js (catalog step groups; Graphic แก้ไข = warning)
//   box      the Current Status box: icon key, Thai status name, sub-line
//   action   ONE of: a primary button / an outlined button (label + actionId +
//            hint), a hint only, or an info card
// Clip keeps its own round-45/46 card (lib/tasks/clipFlow.js) — not moved here.
//
// FLOW_ACTIONS is THE table of the primary-button moves (actionId → from → to,
// what the dialog collects, which timestamp it stores in Task.flow). The server
// action (task-actions.js runFlowAction) reads the same table and still goes
// through transitions.js canTransition.

import { formatThaiDay, formatThaiDayTime } from "../projects/format.js";
import { buildStatusStepper } from "./stepper.js";
import { canTransition } from "./transitions.js";
import { statusInfo } from "./types.js";
import { isDateStr, toMin } from "./workplan.js";
import { sessionTimeLabel } from "./shootSessions.js";
import { isHttpUrl, parseBangkokDateTime } from "../projects/rules.js";

export const STATUS_VIEW_TYPES = ["production", "graphic", "photo", "article", "post"];
export const hasStatusView = (type) => STATUS_VIEW_TYPES.includes(type);

/**
 * Primary-button moves. `dialog`: "shoot" (appointment), "fileLocation"; `stamp`:
 * the Task.flow key set to now. Review actions (submit / resubmit / review) and
 * copy are not status moves here (round 46 dialogs / clipboard).
 */
export const FLOW_ACTIONS = {
  production: {
    set_shoot: { from: "not_started", to: "scheduled", dialog: "shoot" },
    shot: { from: "scheduled", to: "shot", stamp: "shotAt" },
    card: { from: "shot", to: "done", dialog: "fileLocation", stamp: "doneAt" },
  },
  graphic: {
    start: { from: "not_started", to: "in_progress", stamp: "startedAt" },
  },
  photo: {
    shot: { from: "not_started", to: "shot", stamp: "shotAt" },
    filed: { from: "shot", to: "filed", dialog: "fileLocation", stamp: "filedAt" },
    edit_start: { from: "filed", to: "retouching", stamp: "editStartedAt" },
    ready: { from: "retouching", to: "ready", stamp: "readyAt" },
  },
  // Round 49. `branch`: the target is lib/tasks/assets.js draftExitTarget (รอชิ้นงาน
  // while an asset is pending, else รอเผยแพร่). Publishing has its own dialog +
  // action (task-actions.js publishArticleAction / savePostLinksAction).
  article: {
    start_draft: { from: "not_started", to: "drafting", stamp: "startedAt" },
    draft_done: { from: "drafting", branch: true, stamp: "draftDoneAt" },
    publish: { from: "scheduled", to: "published", dialog: "publish" },
  },
  post: {
    plan_done: { from: "drafting", branch: true, stamp: "draftDoneAt" },
    post_links: { from: "scheduled", to: "published", dialog: "postLinks" },
  },
};
export const flowAction = (type, actionId) => FLOW_ACTIONS[type]?.[actionId] ?? null;

/** "28 พ.ย. 13:00" for a legacy shoot { date, time } (old Activity entries); "" when none. */
export const shootLabel = (shoot) => (shoot?.date ? `${formatThaiDay(shoot.date, { weekday: false })}${shoot.time ? ` ${shoot.time}` : ""}` : "");

/** "28 พ.ย. 09:00–17:00" for one session (lib/tasks/shootSessions.js). */
export const sessionLabel = (x) => (x?.date ? `${formatThaiDay(x.date, { weekday: false })} ${sessionTimeLabel(x)}` : "");

/** Production นัดถ่าย sub-line: the first session (+ "และอีก N วัน"), its location. */
const sessionsLine = (sessions) => {
  const [first, ...rest] = sessions ?? [];
  if (!first) return "ยังไม่ได้นัดถ่าย";
  return join(`นัดถ่าย ${sessionLabel(first)}${rest.length ? ` และอีก ${rest.length} วัน` : ""}`, first.location);
};

/**
 * May the ⋯ menu offer "แก้ไขนัดถ่าย"? Production with at least one session, before
 * ถ่ายแล้ว (ยังไม่เริ่ม / นัดถ่ายแล้ว). Round 57.1: Photo has no appointment any more.
 */
export const canReschedule = (type, status, sessions) => type === "production" && (sessions?.length ?? 0) > 0 && ["not_started", "scheduled"].includes(status);

// ── Article / Post (round 49) ─────────────────────────────────────────────

const EMPTY_ASSETS = { total: 0, ready: 0, pending: [], allReady: true, pendingNames: [] };
const cut = (s, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * The รอชิ้นงาน step: hidden when the task has no non-cancelled assets (unless it
 * is the current status); dashed "(ถ้ามี)" before it is reached; "ชิ้นงานครบ"
 * (green) when the draft step skipped it because everything was ready.
 */
function assetStepRules(steps, t) {
  const assets = t.assets ?? EMPTY_ASSETS;
  const i = steps.findIndex((s) => s.key === "waiting_assets");
  if (i < 0) return steps;
  const out = [...steps];
  if (assets.total === 0 && t.status !== "waiting_assets") out.splice(i, 1);
  else if (out[i].state === "upcoming") out[i] = { ...out[i], state: "optional", note: "(ถ้ามี)" };
  else if (out[i].state === "complete" && t.flow?.draftExit === "skipped") out[i] = { ...out[i], note: "ชิ้นงานครบ", noteTone: "success" };
  return out;
}

/** "<name> ถูกตีกลับไปแก้ไข · ตรวจสอบก่อนเผยแพร่" (+ "และอีก N ชิ้น"). */
function assetBanner(assets) {
  const [first, ...rest] = assets.pending;
  if (!first) return null;
  const name = `${first.title}${rest.length ? ` และอีก ${rest.length} ชิ้น` : ""}`;
  const why = first.status === "revising" ? "ถูกตีกลับไปแก้ไข" : "ยังไม่เสร็จ";
  return { title: "มีชิ้นงานที่เกี่ยวข้องยังไม่พร้อม", line: `${name} ${why} · ตรวจสอบก่อนเผยแพร่` };
}

/** Post: the task's platforms with their saved link (if any). */
export function postLinkRows(platforms, links) {
  const byId = new Map((links ?? []).map((l) => [String(l.platformId), l]));
  return (platforms ?? []).map((p) => ({ ...p, link: byId.get(String(p.id))?.url ? byId.get(String(p.id)) : null }));
}

/** Every platform on the post has a link? (no platforms → false: nothing to publish to) */
export const postLinksComplete = (platforms, links) => {
  const rows = postLinkRows(platforms, links);
  return rows.length > 0 && rows.every((r) => !!r.link);
};

/**
 * Article publish form → { value: { url, publishedAt: Date } } or { errors }.
 * raw: { url, date "YYYY-MM-DD", time "HH:mm" } (Bangkok).
 */
export function parseArticlePublish(raw) {
  const errors = {};
  const url = String(raw?.url ?? "").trim();
  if (!url) errors.url = "ใส่ลิงก์บทความ";
  else if (url.length > 2000 || !isHttpUrl(url)) errors.url = "ใส่ลิงก์แบบ http:// หรือ https://";
  const publishedAt = isDateStr(raw?.date) && toMin(raw?.time) != null ? parseBangkokDateTime(raw.date, raw.time, "00:00") : null;
  if (!publishedAt) errors.publishedAt = "เลือกวันและเวลาที่เผยแพร่";
  return Object.keys(errors).length ? { errors } : { value: { url, publishedAt } };
}

/**
 * Post links form (partial saves allowed) → { value: [{ platformId, url, postedAt: Date }] } or
 * { errors: { "<platformId>": message } }. A row without a URL is left out
 * (unsaved); a filled row needs an http(s) URL and a date + time (the dialog
 * defaults them to now). Only the post's own platforms are accepted.
 */
export function parsePostLinks(raw, platformIds) {
  const allowed = new Set((platformIds ?? []).map(String));
  const errors = {};
  const value = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const id = String(r?.platformId ?? "");
    if (!allowed.has(id)) continue;
    const url = String(r?.url ?? "").trim();
    if (!url) continue;
    if (url.length > 2000 || !isHttpUrl(url)) {
      errors[id] = "ใส่ลิงก์แบบ http:// หรือ https://";
      continue;
    }
    const postedAt = isDateStr(r?.date) && toMin(r?.time) != null ? parseBangkokDateTime(r.date, r.time, "00:00") : null;
    if (!postedAt) {
      errors[id] = "เลือกวันและเวลาที่โพสต์";
      continue;
    }
    value.push({ platformId: id, url, postedAt });
  }
  return Object.keys(errors).length ? { errors } : { value };
}

const at = (v) => formatThaiDayTime(v) || "—";
const join = (...parts) => parts.filter(Boolean).join(" · ");

/**
 * @param {{ type: string, status: string, statusBeforeHold?: string|null, createdAt?: unknown,
 *           enteredAt?: unknown, flow?: object, sessions?: object[], fileLocation?: string,
 *           assigneeName?: string|null, complete?: boolean, linkedClips?: number,
 *           canChangeStatus?: boolean, canOverride?: boolean,
 *           review?: { openSubmittedAt?: unknown, closedAt?: unknown, currentStatus?: string|null,
 *                      mine?: string[], canSubmit?: boolean, hasBase?: boolean } }} t
 *   enteredAt = when the task entered its current status (latest status change), the
 *   fallback for every "since" time; `complete` = Production's required data is there.
 * @returns {null | { steps, terminal, box: { icon, title, sub, subTitle?, truncate? }, action: object|null, canReschedule: boolean,
 *                    fileLocation: string }}  fileLocation = the dialog pre-fill
 */
export function buildStatusView(t) {
  if (!hasStatusView(t.type)) return null;
  const stepper = buildStatusStepper(t.type, t.status);
  if (t.type === "article" || t.type === "post") stepper.steps = assetStepRules(stepper.steps, t);
  const flow = t.flow ?? {};
  const title = statusInfo(t.type, t.status).label;
  const since = (key) => flow[key] ?? t.enteredAt;
  const can = (to) => !!t.canChangeStatus && canTransition(t.type, t.status, to, { canOverride: !!t.canOverride, statusBeforeHold: t.statusBeforeHold ?? null }).ok;
  const move = (actionId, label, hint) => {
    const a = flowAction(t.type, actionId);
    return { kind: "button", button: can(a.to) ? { label, actionId } : null, hint };
  };
  const copy = (hint) =>
    t.fileLocation
      ? { kind: "outline", button: { label: "คัดลอก File Location", actionId: "copy", value: t.fileLocation }, hint }
      : { kind: "outline", button: { label: "คัดลอก File Location", actionId: "copy", value: "", disabled: true }, hint: "ยังไม่มี File Location" };

  let box = { icon: "clock", title, sub: "" };
  let action = null;
  let banner = null; // round 49: Article / Post รอเผยแพร่ with a not-ready asset

  if (stepper.terminal) {
    box = { icon: stepper.terminal.kind === "cancelled" ? "x" : "pause", title, sub: t.enteredAt ? `ตั้งแต่ ${at(t.enteredAt)}` : "" };
    return { steps: stepper.steps, terminal: stepper.terminal, box, action: null, canReschedule: false, fileLocation: t.fileLocation ?? "" };
  }

  if (t.type === "production") {
    switch (t.status) {
      case "not_started":
        box = { icon: "clock", title, sub: join(`สร้างเมื่อ ${at(t.createdAt)}`, t.complete ? "ข้อมูลครบ" : "") };
        action = move("set_shoot", "ตั้งวันถ่ายทำ", "เพิ่มวัน เวลา และสถานที่ถ่าย (หลายวันได้)");
        break;
      case "scheduled":
        box = { icon: "calendar", title, sub: sessionsLine(t.sessions) };
        action = move("shot", "ถ่ายทำเรียบร้อย", "กดหลังถ่ายเสร็จ · แก้นัดถ่ายได้จากเมนู ⋯");
        break;
      case "shot":
        box = { icon: "camera", title, sub: `ถ่ายเสร็จ ${at(since("shotAt"))}` };
        action = move("card", "ลงการ์ดแล้ว", "ระบุ File Location ของไฟล์ที่ลงการ์ด");
        break;
      case "done":
        box = { icon: "check", title, sub: `ลงการ์ด ${at(since("doneAt"))}` };
        action = {
          kind: "info",
          info: {
            title: "ไม่มีสิ่งที่ต้องทำ",
            line: t.linkedClips ? "Task ตัดต่อที่เกี่ยวข้องเปลี่ยนเป็น Ready to Edit แล้ว" : "ไม่มี Task ตัดต่อที่เชื่อมไว้",
          },
        };
        break;
      default:
        break;
    }
  }

  if (t.type === "graphic") {
    const r = t.review ?? {};
    switch (t.status) {
      case "not_started":
        box = { icon: "clock", title, sub: join(`มอบหมาย ${formatThaiDay(dayOf(t.createdAt), { weekday: false })}`, `Designer: ${t.assigneeName ?? "ยังไม่มอบหมาย"}`) };
        action = move("start", "เริ่มทำ", "ระบบบันทึกเวลาเริ่มงาน");
        break;
      case "in_progress":
        box = { icon: "palette", title, sub: `เริ่ม ${at(since("startedAt"))}` };
        // After a step-back from แก้ไข the next submit is a Resubmit (round 46.1).
        action = {
          kind: "button",
          button: r.canSubmit ? (r.hasBase ? { label: "ส่งตรวจอีกครั้ง", actionId: "resubmit" } : { label: "ส่งตรวจ", actionId: "submit" }) : null,
          hint: r.hasBase ? "ส่งตรวจใหม่เฉพาะ Design · ใช้ลิงก์รีวิวเดิมเป็นค่าเริ่มต้น" : "แนบลิงก์รีวิว และยืนยัน Reviewer",
        };
        break;
      case "waiting_review":
        box = { icon: "eye", title, sub: `ส่งตรวจ ${at(r.openSubmittedAt ?? t.enteredAt)}` };
        action = (r.mine ?? []).includes("design")
          ? { kind: "button", button: { label: "ตรวจงาน", actionId: "review", section: "design" }, hint: "มุมมอง Reviewer · ผ่าน / ไม่ผ่าน · Feedback ไม่บังคับ" }
          : { kind: "hint", hint: "รอ Reviewer ตรวจ: Design" };
        break;
      case "revising":
        box = { icon: "warning", title, sub: join(`ผลตรวจ ${at(r.currentStatus === "revision" ? r.closedAt : t.enteredAt)}`, "ไม่ผ่าน") };
        action = {
          kind: "button",
          button: r.canSubmit ? { label: "ส่งตรวจใหม่", actionId: r.hasBase ? "resubmit" : "submit" } : null,
          hint: "ใช้ลิงก์รีวิวเดิมเป็นค่าเริ่มต้น",
        };
        break;
      case "done":
        box = {
          icon: "check",
          title,
          sub: r.currentStatus === "passed" ? join(`ผ่านการตรวจ ${at(r.closedAt)}`, "อัตโนมัติ") : `เสร็จ ${at(t.enteredAt)}`,
        };
        action = copy("ไฟล์งานสุดท้ายพร้อมใช้");
        break;
      default:
        break;
    }
  }

  if (t.type === "photo") {
    switch (t.status) {
      case "not_started":
        // Round 57.1: no นัดถ่าย for Photo (its Shoot Date is the task's Start).
        box = { icon: "clock", title, sub: `สร้างเมื่อ ${at(t.createdAt)}` };
        action = move("shot", "ถ่ายเสร็จแล้ว", "กดหลังถ่ายภาพเสร็จ");
        break;
      case "shot":
        box = { icon: "camera", title, sub: `ถ่ายเสร็จ ${at(since("shotAt"))}` };
        action = move("filed", "ยืนยันไฟล์เข้าโฟลเดอร์", "ระบุ File Location ของโฟลเดอร์ภาพ");
        break;
      case "filed":
        box = { icon: "folder", title, sub: t.fileLocation || "ยังไม่มี File Location", subTitle: t.fileLocation || undefined, truncate: true };
        action = move("edit_start", "เริ่มแต่งภาพ", "ระบบบันทึกเวลาเริ่มแต่งภาพ");
        break;
      case "retouching":
        box = { icon: "palette", title, sub: `เริ่มแต่ง ${at(since("editStartedAt"))}` };
        action = move("ready", "แต่งเสร็จ พร้อมใช้งาน", "ยืนยันว่าไฟล์ที่แต่งแล้วอยู่ใน File Location");
        break;
      case "ready":
        box = { icon: "check", title, sub: `พร้อมใช้ ${at(since("readyAt"))}` };
        action = copy("ไฟล์ภาพพร้อมใช้งาน");
        break;
      default:
        break;
    }
  }


  if (t.type === "article" || t.type === "post") {
    const isPost = t.type === "post";
    const assets = t.assets ?? EMPTY_ASSETS;
    const draftHint = "ชิ้นงานยังไม่ครบ → รอชิ้นงาน · ครบแล้ว/ไม่มี → รอเผยแพร่";
    const waiting = () => ({
      icon: "box",
      title,
      sub: join(
        `${isPost ? "ชิ้นงานพร้อม" : "ชิ้นงานที่เกี่ยวข้องพร้อม"} ${assets.ready} จาก ${assets.total}`,
        assets.pendingNames.length ? `รอ ${cut(assets.pendingNames.join(", "))}` : ""
      ),
    });
    switch (t.status) {
      case "not_started": // Article only
        box = { icon: "clock", title, sub: join(`มอบหมาย ${formatThaiDay(dayOf(t.createdAt), { weekday: false })}`, `Writer: ${t.assigneeName ?? "ยังไม่มอบหมาย"}`) };
        action = move("start_draft", "เริ่มร่าง", "ระบบบันทึกเวลาเริ่มงาน");
        break;
      case "drafting": {
        box = isPost
          ? { icon: "pencil", title, sub: join(`สร้าง ${formatThaiDay(dayOf(t.createdAt), { weekday: false })}`, `Platform: ${(t.platforms ?? []).map((p) => p.label).join(", ") || "—"}`) }
          : { icon: "pencil", title, sub: `เริ่มร่าง ${at(since("startedAt"))}` };
        // The branch target decides which arrow must be legal.
        const to = assets.allReady ? "scheduled" : "waiting_assets";
        const ok = !!t.canChangeStatus && canTransition(t.type, t.status, to, { canOverride: !!t.canOverride, hasRelatedAssets: true, allowAuto: true }).ok;
        action = { kind: "button", button: ok ? { label: isPost ? "แผนงานครบถ้วน" : "ร่างเสร็จ", actionId: isPost ? "plan_done" : "draft_done" } : null, hint: draftHint };
        break;
      }
      case "waiting_assets":
        box = waiting();
        action = { kind: "info", info: { title: "เปลี่ยนสถานะอัตโนมัติ", line: "เปลี่ยนเป็นรอเผยแพร่เมื่อชิ้นงานที่เกี่ยวข้องเสร็จครบ", icon: "auto" } };
        break;
      case "scheduled": {
        const exit = t.flow?.draftExit;
        const draftWord = isPost ? "ร่างแผนงาน" : "ร่างบทความ";
        const atExit = isPost ? "ตอนแผนงานครบ" : "ตอนร่างเสร็จ";
        let sub =
          exit === "no_assets"
            ? `ไม่มีชิ้นงานที่เกี่ยวข้อง · ข้ามจาก${draftWord}`
            : exit === "skipped"
              ? `ชิ้นงานที่เกี่ยวข้องพร้อมครบ ${t.flow.assetsAtExit ?? assets.total} จาก ${t.flow.assetsAtExit ?? assets.total} · ${atExit}`
              : t.dueAt
                ? `${isPost ? "กำหนดโพสต์" : "กำหนดเผยแพร่"} ${at(t.dueAt)}`
                : isPost
                  ? "ยังไม่กำหนดวันโพสต์"
                  : "ยังไม่กำหนดวันเผยแพร่";
        if (isPost) {
          const rows = postLinkRows(t.platforms, t.flow?.publishLinks);
          const n = rows.filter((r) => r.link).length;
          if (n) sub += ` · โพสต์แล้ว ${n} จาก ${rows.length} Platform`;
        }
        box = { icon: "send", title, sub };
        action = isPost
          ? move("post_links", "บันทึกการโพสต์", "ใส่ลิงก์โพสต์ของแต่ละ Platform")
          : move("publish", "บันทึกการเผยแพร่", "ใส่ลิงก์บทความและวันเวลาที่เผยแพร่");
        // No automatic step backward: a not-ready asset only raises the banner.
        banner = assetBanner(assets);
        if (banner) action.hint = "ยังกดได้ · สถานะไม่ถอยกลับอัตโนมัติ";
        break;
      }
      case "published":
        if (isPost) {
          const rows = postLinkRows(t.platforms, t.flow?.publishLinks).filter((r) => r.link);
          const latest = rows.map((r) => r.link.postedAt).sort().at(-1);
          box = { icon: "globe", title, sub: join(`โพสต์ ${at(latest ?? t.enteredAt)}`, `${rows.length} Platform`) };
          action = {
            kind: "outline",
            button: rows.length
              ? { label: "เปิดโพสต์", actionId: "open_posts", links: rows.map((r) => ({ id: r.id, label: r.label, icon: r.icon ?? null, url: r.link.url })) }
              : { label: "เปิดโพสต์", actionId: "open_posts", links: [], disabled: true },
            hint: rows.length ? "ดูโพสต์ที่ทำการโพสต์แล้ว" : "ยังไม่มีลิงก์โพสต์",
          };
        } else {
          const url = t.flow?.publishedUrl ?? "";
          box = { icon: "globe", title, sub: `เผยแพร่ ${at(t.flow?.publishedAt ?? t.enteredAt)}` };
          action = {
            kind: "outline",
            button: { label: "เปิดบทความ", actionId: "open_url", value: url, disabled: !url },
            hint: url || "ยังไม่มีลิงก์บทความ",
            truncateHint: !!url,
          };
        }
        break;
      default:
        break;
    }
  }

  return {
    steps: stepper.steps,
    terminal: null,
    box,
    action,
    banner,
    canReschedule: canReschedule(t.type, t.status, t.sessions),
    fileLocation: t.fileLocation ?? "",
    // Post: its platforms with any saved link (the "บันทึกการโพสต์" dialog rows).
    ...(t.type === "post" ? { postLinks: postLinkRows(t.platforms, t.flow?.publishLinks) } : {}),
  };
}

/** A datetime → its Bangkok calendar day "YYYY-MM-DD" (for formatThaiDay). */
const bkk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = (v) => (v ? bkk.format(new Date(v)) : "");
