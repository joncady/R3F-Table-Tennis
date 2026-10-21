import { useEffect, useState } from "react";
import {
  deleteRecording,
  exportRecording,
  listRecordings,
  type SavedRecording,
} from "./recordingStore";
export default function RecordingLibrary({
  revision,
  active,
}: {
  revision: number;
  active: boolean;
}) {
  const [rows, setRows] = useState<SavedRecording[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void listRecordings()
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) setMessage("Local recording storage is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [revision, refresh]);
  const save = async (row: SavedRecording, kind: "video" | "data") => {
    setBusy(true);
    setMessage("Saving export…");
    try {
      await exportRecording(row, kind);
      setMessage(
        "Export ready. The local copy is retained until you delete it.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === "AbortError"
          ? "Save cancelled. Your local recording is still available."
          : "Export failed. Your local recording is still available; retry saving.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="recording-library">
      <h3>Saved recordings</h3>
      <p>
        Captures stay in this browser, including chunks saved before an
        interrupted session. Export before clearing site data. Save streams to
        disk where supported; other browsers assemble the download at export
        time.
      </p>
      {message && <p role="status">{message}</p>}
      {!rows.length && <p>No saved recordings.</p>}
      {rows.map((row) => (
        <article key={row.id}>
          <strong>{new Date(row.startedAt).toLocaleString()}</strong>
          <p>
            {row.status === "complete" ? "Complete" : "Partial / recoverable"} ·{" "}
            {Math.round(row.duration)} s · {(row.bytes / 1048576).toFixed(1)} MB
          </p>
          <button
            disabled={active || busy || !row.videoChunks}
            onClick={() => void save(row, "video")}
          >
            Save video
          </button>
          <button
            disabled={active || busy || !row.dataChunks}
            onClick={() => void save(row, "data")}
          >
            Save motion data
          </button>
          <button
            disabled={active || busy}
            onClick={() => {
              setBusy(true);
              void deleteRecording(row.id)
                .then(() => setRefresh((n) => n + 1))
                .catch(() =>
                  setMessage("Could not delete the local recording."),
                )
                .finally(() => setBusy(false));
            }}
          >
            Delete local copy
          </button>
        </article>
      ))}
    </section>
  );
}
