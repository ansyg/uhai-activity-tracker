"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown } from "@/components/icons";

interface InvalidRow {
  rowNumber: number;
  title: string | null;
  errors: string[];
}

interface UploadResult {
  savedCount: number;
  newPhaseCount: number;
  invalidRows: InvalidRow[];
}

export function ImportXlsButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/trackers/${trackerId}/import/upload`, {
        method: "POST",
        body: formData,
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setResult(data as UploadResult);
      if ((data as UploadResult).savedCount > 0) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const showReport = uploading || result || error;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn"
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        Import XLS
        <IconChevronDown size={13} />
      </button>

      {menuOpen && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 20,
            padding: 6,
            minWidth: 190,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <a
            href={`/api/trackers/${trackerId}/import/template?t=${Date.now()}`}
            className="btn btn-ghost"
            style={{ justifyContent: "flex-start", fontSize: "0.88em" }}
            onMouseDown={(e) => e.preventDefault()}
          >
            Download template
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ justifyContent: "flex-start", fontSize: "0.88em" }}
            onMouseDown={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
          >
            Upload XLS
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={handleFile}
        disabled={uploading}
      />

      {showReport && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 30,
            padding: 18,
            width: 380,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {uploading && (
            <p className="muted" style={{ fontSize: "0.9em" }}>
              Checking and saving rows…
            </p>
          )}

          {error && (
            <p className="error-text" style={{ fontSize: "0.9em" }}>
              {error}
            </p>
          )}

          {result && (
            <>
              {result.savedCount > 0 && (
                <p
                  style={{
                    fontWeight: 600,
                    marginBottom: result.invalidRows.length > 0 ? 10 : 0,
                  }}
                >
                  Saved {result.savedCount} activit
                  {result.savedCount === 1 ? "y" : "ies"}
                  {result.newPhaseCount > 0 && (
                    <>
                      {" "}
                      across {result.newPhaseCount} new phase
                      {result.newPhaseCount === 1 ? "" : "s"}
                    </>
                  )}
                  .
                </p>
              )}
              {result.invalidRows.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>
                    {result.invalidRows.length} row
                    {result.invalidRows.length === 1 ? "" : "s"} skipped — fix
                    and re-upload:
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {result.invalidRows.map((row) => (
                      <div key={row.rowNumber} style={{ fontSize: "0.85em" }}>
                        <div style={{ fontWeight: 600 }}>
                          Row {row.rowNumber}
                          {row.title ? ` — ${row.title}` : ""}
                        </div>
                        <ul
                          style={{
                            margin: "2px 0 0",
                            paddingLeft: 18,
                            color: "var(--danger)",
                          }}
                        >
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {result.savedCount === 0 && result.invalidRows.length === 0 && (
                <p className="muted" style={{ fontSize: "0.9em" }}>
                  No rows found in that file.
                </p>
              )}
              <button
                className="btn btn-ghost"
                type="button"
                style={{ marginTop: 14, fontSize: "0.85em" }}
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
              >
                Done
              </button>
            </>
          )}

          {error && !uploading && (
            <button
              className="btn btn-ghost"
              type="button"
              style={{ marginTop: 10, fontSize: "0.85em" }}
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
