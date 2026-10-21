export interface SavedRecording {
  id: string;
  startedAt: string;
  mime: string;
  hasAudio: boolean;
  duration: number;
  status: "recording" | "complete" | "interrupted";
  videoChunks: number;
  dataChunks: number;
  bytes: number;
}
type ChunkKind = "video" | "data";
let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("table-tennis-playtests", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("recordings", { keyPath: "id" });
      const chunks = request.result.createObjectStore("chunks", {
        keyPath: ["id", "kind", "index"],
      });
      chunks.createIndex("recording", "id");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      database = undefined;
      reject(Error("Close other game tabs to open recording storage."));
    };
  }));
}
function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || Error("Recording storage transaction failed"));
    tx.onerror = () => {};
  });
}
export async function createRecording(
  mime: string,
  hasAudio: boolean,
): Promise<SavedRecording> {
  const recording: SavedRecording = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    mime,
    hasAudio,
    duration: 0,
    status: "recording",
    videoChunks: 0,
    dataChunks: 0,
    bytes: 0,
  };
  const db = await open(),
    tx = db.transaction("recordings", "readwrite"),
    finished = done(tx);
  tx.objectStore("recordings").add(recording);
  await finished;
  return recording;
}
export async function appendRecording(
  id: string,
  kind: ChunkKind,
  blob: Blob,
  duration: number,
) {
  const db = await open(),
    tx = db.transaction(["recordings", "chunks"], "readwrite"),
    finished = done(tx),
    records = tx.objectStore("recordings");
  const request = records.get(id);
  request.onsuccess = () => {
    const row = request.result as SavedRecording | undefined;
    if (!row) {
      tx.abort();
      return;
    }
    const count = kind === "video" ? "videoChunks" : "dataChunks";
    tx.objectStore("chunks").add({ id, kind, index: row[count], blob });
    row[count]++;
    row.bytes += blob.size;
    row.duration = duration;
    records.put(row);
  };
  await finished;
}
export async function finishRecording(
  id: string,
  duration: number,
  interrupted: boolean,
) {
  const db = await open(),
    tx = db.transaction("recordings", "readwrite"),
    finished = done(tx),
    records = tx.objectStore("recordings"),
    request = records.get(id);
  let row: SavedRecording | undefined;
  request.onsuccess = () => {
    row = request.result;
    if (!row) {
      tx.abort();
      return;
    }
    row.duration = duration;
    row.status = interrupted ? "interrupted" : "complete";
    records.put(row);
  };
  await finished;
  return row!;
}
export async function listRecordings(): Promise<SavedRecording[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("recordings")
      .objectStore("recordings")
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as SavedRecording[]).sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt),
        ),
      );
    request.onerror = () => reject(request.error);
  });
}
export async function deleteRecording(id: string) {
  const db = await open(),
    tx = db.transaction(["recordings", "chunks"], "readwrite"),
    finished = done(tx);
  tx.objectStore("recordings").delete(id);
  const cursor = tx
    .objectStore("chunks")
    .index("recording")
    .openCursor(IDBKeyRange.only(id));
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (c) {
      c.delete();
      c.continue();
    }
  };
  await finished;
}
async function readChunk(
  id: string,
  kind: ChunkKind,
  index: number,
): Promise<Blob> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("chunks")
      .objectStore("chunks")
      .get([id, kind, index]);
    r.onsuccess = () =>
      r.result
        ? resolve(r.result.blob)
        : reject(Error("A saved recording chunk is missing."));
    r.onerror = () => reject(r.error);
  });
}
export interface RecordingWriter {
  write(data: Blob | string): Promise<unknown>;
  close(): Promise<unknown>;
  abort?(): Promise<unknown>;
}
// One chunk is read at a time, with disk write backpressure. Never load the
// whole capture or all telemetry rows just to stream an export.
export async function writeRecording(
  row: SavedRecording,
  kind: ChunkKind,
  writer: RecordingWriter,
) {
  try {
    if (kind === "video") {
      for (let i = 0; i < row.videoChunks; i++)
        await writer.write(await readChunk(row.id, kind, i));
    } else {
      await writer.write(
        JSON.stringify({ version: 2, kind: "full-playtest", ...row }).slice(
          0,
          -1,
        ) + ',"rows":[',
      );
      let separator = "";
      for (let i = 0; i < row.dataChunks; i++) {
        const text = await (await readChunk(row.id, kind, i)).text(),
          content = text.slice(1, -1);
        if (content) {
          await writer.write(separator + content);
          separator = ",";
        }
      }
      await writer.write("]}");
    }
    await writer.close();
  } catch (error) {
    await writer.abort?.();
    throw error;
  }
}
export async function exportRecording(row: SavedRecording, kind: ChunkKind) {
  const extension =
      kind === "data" ? "json" : row.mime.includes("mp4") ? "mp4" : "webm",
    name = `ping-pong-playtest-${row.id}.${extension}`;
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: {
        suggestedName: string;
      }) => Promise<{ createWritable(): Promise<RecordingWriter> }>;
    }
  ).showSaveFilePicker;
  // Invoke the picker before the first await to retain click activation.
  if (picker) {
    const handle = await picker.call(window, { suggestedName: name });
    await writeRecording(row, kind, await handle.createWritable());
    return;
  }
  // Browsers without a streaming save picker assemble only when exporting,
  // never during capture. The durable source remains available for retry.
  const parts: BlobPart[] = [];
  await writeRecording(row, kind, {
    async write(part) {
      parts.push(part);
    },
    async close() {},
  });
  const url = URL.createObjectURL(
      new Blob(parts, {
        type: kind === "data" ? "application/json" : row.mime,
      }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
