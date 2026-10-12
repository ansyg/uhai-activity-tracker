"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api/client";

interface AttachmentData {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedByName: string;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ActivityAttachments({
  activityId,
  initialAttachments,
  canEdit,
}: {
  activityId: string;
  initialAttachments: AttachmentData[];
  canEdit: boolean;
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const contentType = file.type || "application/octet-stream";
      const presign = await api.post<{ uploadUrl: string; key: string }>(
        `/api/activities/${activityId}/attachments/presign`,
        { fileName: file.name, contentType, fileSize: file.size }
      );

      // Straight to R2, not through our server — this is a raw PUT with the
      // file as the body, not a JSON call, so it bypasses the api client.
      const uploadRes = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
      if (!uploadRes.ok) throw new Error("Upload to storage failed.");

      const result = await api.post<{ attachment: AttachmentData & { uploadedBy: { name: string } } }>(
        `/api/activities/${activityId}/attachments`,
        { key: presign.key, fileName: file.name, contentType, fileSize: file.size }
      );
      setAttachments((prev) => [{ ...result.attachment, uploadedByName: result.attachment.uploadedBy.name }, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    setBusyId(attachmentId);
    setError(null);
    try {
      await api.delete(`/api/activities/${activityId}/attachments/${attachmentId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that attachment.");
    } finally {
      setBusyId(null);
    }
  }

  if (attachments.length === 0 && !canEdit) return null;

  return (
    <div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: canEdit ? 14 : 0 }}>
          {attachments.map((attachment) => (
            <div key={attachment.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9em" }}>
              <a href={attachment.fileUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 560, color: "var(--primary)" }}>
                {attachment.fileName}
              </a>
              <span className="muted" style={{ fontSize: "0.85em" }}>
                {formatSize(attachment.fileSize)} · {attachment.uploadedByName}
              </span>
              {canEdit && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  style={{ padding: "2px 8px", fontSize: "0.78em", marginLeft: "auto" }}
                  disabled={busyId === attachment.id}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  {busyId === attachment.id ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <>
          <input ref={fileInputRef} type="file" onChange={handleFileSelected} disabled={uploading} style={{ display: "none" }} />
          <button
            className="btn"
            type="button"
            style={{ fontSize: "0.85em", padding: "6px 14px" }}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Attach a file"}
          </button>
        </>
      )}
      {error && <p className="error-text" style={{ fontSize: "0.85em", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
