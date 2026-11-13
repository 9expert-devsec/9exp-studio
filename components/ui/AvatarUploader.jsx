"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import Avatar from "./Avatar";
import Button from "./Button";

// Profile-picture picker shared by /account and the Team → Accounts edit modal.
//
// Keeps uploads small (shared Cloudinary cloud near its limit; server-action body
// limit stays at the default): the browser centre-crops to a square and downscales
// to at most 512×512 on a <canvas>, encodes WebP q≈0.85 (JPEG fallback), and refuses
// anything still over 900 KB. The server re-validates everything.
//
// Props:
//   name, url       current picture (url null/undefined → initials)
//   onSave(fd)      server action taking FormData with `avatar` → { ok, avatarUrl } | { ok:false, error }
//   onRemove()      server action → { ok } | { ok:false, error }
//   size            preview size (default 96)
//
// Deferred mode (`deferred` + `onPrepared`), for forms that create the record first
// (Team → Add account): same crop/resize/preview, but no Save/Remove calls. The
// prepared Blob (or null when cleared) is handed to `onPrepared`, and the parent
// sends it with its own form.

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL = 10 * 1024 * 1024; // 10 MB
const MAX_OUTPUT = 900 * 1024; // 900 KB
const TARGET = 512;
const QUALITY = 0.85;

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img> decoding
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = objectUrl;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const toBlob = (canvas, type) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, QUALITY));

async function prepare(file) {
  const source = await decode(file);
  const w = source.width;
  const h = source.height;
  if (!w || !h) throw new Error("decode");

  const side = Math.min(w, h);
  const out = Math.min(TARGET, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  source.close?.();

  let blob = await toBlob(canvas, "image/webp");
  // Browsers without WebP encoding silently return PNG (or null): use JPEG then.
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg");
  if (!blob) throw new Error("encode");
  return blob;
}

export default function AvatarUploader({
  name,
  url,
  onSave,
  onRemove,
  size = 96,
  deferred = false,
  onPrepared,
}) {
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef(null);

  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  // undefined = use the `url` prop; string/null = what the last save/remove returned.
  const [savedUrl, setSavedUrl] = useState(undefined);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [preparing, setPreparing] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentUrl = savedUrl === undefined ? url : savedUrl;
  const busy = preparing || pending;

  // Free the preview object URL when it changes or the component unmounts.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    setBlob(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (deferred) {
      // Keep the input's new FileList; just drop the previous preview and blob.
      setBlob(null);
      setPreview(null);
      onPrepared?.(null);
    } else {
      reset();
    }

    if (!ACCEPT.includes(file.type)) {
      setStatus({ kind: "error", text: "Choose a JPEG, PNG or WebP picture." });
      return;
    }
    if (file.size > MAX_ORIGINAL) {
      setStatus({ kind: "error", text: "That picture is over 10 MB. Choose a smaller one." });
      return;
    }

    setPreparing(true);
    setStatus({ kind: "idle", text: "Preparing preview…" });
    try {
      const prepared = await prepare(file);
      if (prepared.size > MAX_OUTPUT) {
        setStatus({ kind: "error", text: "That picture is still over 900 KB after resizing. Try another one." });
        return;
      }
      setBlob(prepared);
      setPreview(URL.createObjectURL(prepared));
      if (deferred) {
        onPrepared?.(prepared);
        setStatus({ kind: "idle", text: "Photo ready. It is uploaded when you save the form." });
      } else {
        setStatus({ kind: "idle", text: "Preview ready. Save to use this picture." });
      }
    } catch {
      setStatus({ kind: "error", text: "That picture could not be read. Try another one." });
    } finally {
      setPreparing(false);
    }
  };

  const save = () => {
    if (!blob) return;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const fd = new FormData();
    fd.set("avatar", new File([blob], `avatar.${ext}`, { type: blob.type }));
    setStatus({ kind: "idle", text: "Saving…" });
    startTransition(async () => {
      const result = await onSave(fd);
      if (result?.ok) {
        setSavedUrl(result.avatarUrl ?? null);
        reset();
        setStatus({ kind: "success", text: "Profile picture updated." });
      } else {
        setStatus({ kind: "error", text: result?.error ?? "The picture could not be saved." });
      }
    });
  };

  const remove = () => {
    reset();
    setStatus({ kind: "idle", text: "Removing…" });
    startTransition(async () => {
      const result = await onRemove();
      if (result?.ok) {
        setSavedUrl(null);
        setStatus({ kind: "success", text: "Profile picture removed." });
      } else {
        setStatus({ kind: "error", text: result?.error ?? "The picture could not be removed." });
      }
    });
  };

  const cancel = () => {
    reset();
    setStatus({ kind: "idle", text: "" });
  };

  const clearDeferred = () => {
    reset();
    onPrepared?.(null);
    setStatus({ kind: "idle", text: "" });
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {preview ? (
        // Circular preview of exactly what will be uploaded (a local blob: URL).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Preview of the new profile picture"
          width={size}
          height={size}
          className="shrink-0 rounded-full border border-line object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <Avatar name={name} url={currentUrl} size={size} />
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT.join(",")}
        onChange={onPick}
        disabled={busy}
        className="sr-only"
        aria-describedby={statusId}
      />

      <div className="flex flex-wrap gap-2">
        {deferred ? (
          <>
            <Button
              variant="secondary"
              icon={preparing ? undefined : Camera}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-controls={inputId}
            >
              {preparing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {preview ? "Change photo" : "Add photo"}
            </Button>
            {preview && (
              <Button variant="secondary" icon={Trash2} onClick={clearDeferred} disabled={busy}>
                Remove photo
              </Button>
            )}
          </>
        ) : preview ? (
          <>
            <Button onClick={save} disabled={busy}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
            <Button variant="secondary" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={preparing ? undefined : Camera}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-controls={inputId}
            >
              {preparing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {currentUrl ? "Change photo" : "Upload photo"}
            </Button>
            {currentUrl && (
              <Button variant="secondary" icon={Trash2} onClick={remove} disabled={busy}>
                Remove photo
              </Button>
            )}
          </>
        )}
      </div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${
          status.kind === "error" ? "text-danger" : status.kind === "success" ? "text-success" : "text-fg-muted"
        }`}
      >
        {status.text || "JPEG, PNG or WebP, up to 10 MB. It is cropped to a square."}
      </p>
    </div>
  );
}
