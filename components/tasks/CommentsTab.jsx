"use client";

// Task Detail → Comments (round 46): a flat list, oldest first, with the composer
// fixed at the bottom of the tab. Data: lib/tasks/comments.js loadComments
// (panel.comments); writes: comment-actions.js. After a write the panel refetches
// (invalidateTaskPanel). No threads, mentions, attachments or reactions.

import { useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/app/(app)/projects/comment-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const textareaClass =
  "w-full resize-y rounded-[12px] border border-line bg-card px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

/** Text with line breaks kept and http(s) URLs as links. */
function Linkified({ text }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-line break-words text-sm text-fg">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-info underline">
            {part}
          </a>
        ) : (
          part
        )
      )}
    </p>
  );
}

/** Ctrl/Cmd+Enter submits. */
const onSubmitKey = (submit) => (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    submit();
  }
};

export default function CommentsTab({ taskId, comments }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef(null);
  const send = () => {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      const res = await addCommentAction(taskId, text);
      if (res?.ok) {
        setText("");
        invalidateTaskPanel();
      } else toast(res?.error ?? "Couldn't send the comment.", { tone: "error" });
    });
  };
  return (
    <div className="flex flex-col gap-4">
      {comments.items.length === 0 ? (
        <p className="rounded-[12px] bg-card-inset py-8 text-center text-sm text-fg-muted">ยังไม่มีความคิดเห็น</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.items.map((c) => (
            <li key={c.id}>
              <CommentItem c={c} />
            </li>
          ))}
        </ol>
      )}
      {comments.canComment && (
        <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t border-line bg-card px-1 pb-1 pt-3">
          <label htmlFor="comment-new" className="sr-only">เขียนความคิดเห็น</label>
          <textarea
            ref={ref}
            id="comment-new"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onSubmitKey(send)}
            placeholder="เขียนความคิดเห็น…"
            className={textareaClass}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-fg-muted">Ctrl/⌘ + Enter เพื่อส่ง</p>
            <button type="button" onClick={send} disabled={!text.trim() || pending} className={buttonClass("primary", "min-h-9")}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              ส่ง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ c }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn, done) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.ok) {
        done?.();
        invalidateTaskPanel();
      } else toast(res?.error ?? "Something went wrong.", { tone: "error" });
    });
  const save = () => {
    if (!draft.trim() || pending) return;
    run(() => editCommentAction(c.id, draft), () => setEditing(false));
  };
  // Same confirm pattern as Delete content (ProjectMenu.jsx DeleteContentDialog).
  const remove = () => run(() => deleteCommentAction(c.id), () => setConfirming(false));

  return (
    <article className="flex gap-3">
      <Avatar name={c.authorName} url={c.avatarUrl} size={32} />
      <div className="min-w-0 flex-1 rounded-[12px] bg-card-inset px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-sm">
            <span className="font-semibold text-fg">{c.authorName}</span>{" "}
            <time dateTime={c.at} title={c.fullLabel} className="text-xs text-fg-muted">
              {c.relLabel}
            </time>
            {c.edited && <span className="text-xs text-fg-muted"> (แก้ไขแล้ว)</span>}
          </p>
          {!editing && (c.canEdit || c.canDelete) && (
            <span className="flex gap-1">
              {c.canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(c.text);
                    setEditing(true);
                  }}
                  aria-label="แก้ไขความคิดเห็น"
                  className="flex size-7 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              )}
              {c.canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={pending}
                  aria-label="ลบความคิดเห็น"
                  className="flex size-7 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </span>
          )}
        </div>
        {c.deleted ? (
          <p className="mt-0.5 text-sm italic text-fg-muted">ความคิดเห็นถูกลบ</p>
        ) : editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor={`comment-edit-${c.id}`} className="sr-only">แก้ไขความคิดเห็น</label>
            <textarea
              id={`comment-edit-${c.id}`}
              rows={3}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onSubmitKey(save)}
              className={textareaClass}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className={buttonClass("outline", "min-h-9")}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={!draft.trim() || pending} className={buttonClass("primary", "min-h-9")}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-0.5">
            <Linkified text={c.text} />
          </div>
        )}
      </div>
      {c.canDelete && (
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          closeOnBackdrop
          title="ลบความคิดเห็น?"
          description="ความคิดเห็นนี้จะแสดงเป็น “ความคิดเห็นถูกลบ”"
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass("secondary")} data-autofocus>
              ยกเลิก
            </button>
            <button type="button" onClick={remove} disabled={pending} className={buttonClass("danger")}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              ลบ
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}
