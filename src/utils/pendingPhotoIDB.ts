/**
 * Fotos offline: IndexedDB (~ mucho mayor que localStorage).
 * Solo metadatos en localStorage (`aquatrack_pending_photos_meta`).
 * Migra clave legada `pendingPhotos` si aún existe.
 */

const DB_NAME = 'aquatrack-pending-v1';
const STORE = 'photos';
export const META_KEY = 'aquatrack_pending_photos_meta';
const LEGACY_LS_KEY = 'pendingPhotos';

export type PendingPhotoMeta = {
  meterCode: string;
  timestamp: number;
  mimeType: string;
};

export function photoStorageKey(meterCode: string, timestamp: number): string {
  return `${meterCode}__${timestamp}`;
}

let dbOpening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbOpening) return dbOpening;
  dbOpening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
  return dbOpening;
}

export async function putPendingPhotoBlob(
  meterCode: string,
  timestamp: number,
  blob: Blob
): Promise<void> {
  const db = await openDb();
  const key = photoStorageKey(meterCode, timestamp);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.objectStore(STORE).put(blob, key);
  });
}

export async function getPendingPhotoBlob(
  meterCode: string,
  timestamp: number
): Promise<Blob | null> {
  const db = await openDb();
  const key = photoStorageKey(meterCode, timestamp);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result ?? null);
    rq.onerror = () => reject(rq.error);
  });
}

export async function deletePendingPhotoBlob(
  meterCode: string,
  timestamp: number
): Promise<void> {
  const db = await openDb();
  const key = photoStorageKey(meterCode, timestamp);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.objectStore(STORE).delete(key);
  });
}

export function readMetaFromLocalStorage(): PendingPhotoMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingPhotoMeta[]) : [];
  } catch {
    return [];
  }
}

export function writeMetaToLocalStorage(meta: PendingPhotoMeta[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob {
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const mimeMatch = dataUrl.startsWith('data:') ? dataUrl.match(/^data:([^;,]+)[;,]/) : null;
  const type = mimeMatch?.[1] || fallbackMime || 'image/jpeg';
  return new Blob([ab], { type });
}

export async function migrateLegacyPendingPhotosLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(LEGACY_LS_KEY);
  if (!raw) return;

  try {
    const legacy = JSON.parse(raw) as Array<{
      meterCode: string;
      timestamp: number;
      file?: { data?: string; type?: string };
    }>;

    let existing = readMetaFromLocalStorage();
    const mergedKeys = new Set(
      existing.map((m) => photoStorageKey(m.meterCode, m.timestamp))
    );

    if (Array.isArray(legacy)) {
      for (const item of legacy) {
        if (!item?.meterCode || item.timestamp == null || !item.file?.data) {
          continue;
        }
        try {
          const blob = dataUrlToBlob(
            item.file.data,
            item.file.type || 'image/jpeg'
          );
          await putPendingPhotoBlob(item.meterCode, item.timestamp, blob);
          const k = photoStorageKey(item.meterCode, item.timestamp);
          if (!mergedKeys.has(k)) {
            existing.push({
              meterCode: item.meterCode,
              timestamp: item.timestamp,
              mimeType: blob.type || 'image/jpeg',
            });
            mergedKeys.add(k);
          }
        } catch {
          console.warn('[pendingPhotoIDB] Fila legacy omitida:', item?.meterCode);
        }
      }
    }

    writeMetaToLocalStorage(existing);
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    console.error('[pendingPhotoIDB] migración desde pendingPhotos legacy falló');
  }
}

export async function loadAllPendingPhotosIntoState(): Promise<
  Array<{ meterCode: string; timestamp: number; file: Blob }>
> {
  await migrateLegacyPendingPhotosLocalStorage();

  const meta = readMetaFromLocalStorage();
  const out: Array<{ meterCode: string; timestamp: number; file: Blob }> = [];
  const validMeta: PendingPhotoMeta[] = [];

  for (const m of meta) {
    const blob = await getPendingPhotoBlob(m.meterCode, m.timestamp);
    if (blob) {
      validMeta.push(m);
      out.push({ meterCode: m.meterCode, timestamp: m.timestamp, file: blob });
    }
  }

  if (validMeta.length !== meta.length) {
    writeMetaToLocalStorage(validMeta);
  }

  return out;
}

/** Sincroniza cola React con IDB + metadatos; borra blobs huérfanos. */
export async function persistPendingPhotosQueue(
  photos: Array<{ meterCode: string; timestamp: number; file: unknown }>
): Promise<void> {
  try {
    const oldMeta = readMetaFromLocalStorage();
    const newKeys = new Set(
      photos.map((p) => photoStorageKey(p.meterCode, p.timestamp))
    );

    for (const om of oldMeta) {
      const k = photoStorageKey(om.meterCode, om.timestamp);
      if (!newKeys.has(k)) {
        await deletePendingPhotoBlob(om.meterCode, om.timestamp);
      }
    }

    const nextMeta: PendingPhotoMeta[] = [];

    for (const p of photos) {
      let blob: Blob | null = null;

      if (p.file instanceof Blob) {
        blob = p.file;
      } else if (
        p.file &&
        typeof p.file === 'object' &&
        'data' in (p.file as object)
      ) {
        const fd = p.file as { data: string; type?: string };
        blob = dataUrlToBlob(fd.data, fd.type || 'image/jpeg');
      }

      if (!blob || blob.size === 0) {
        continue;
      }

      await putPendingPhotoBlob(p.meterCode, p.timestamp, blob);
      nextMeta.push({
        meterCode: p.meterCode,
        timestamp: p.timestamp,
        mimeType: blob.type || 'image/jpeg',
      });
    }

    writeMetaToLocalStorage(nextMeta);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('[pendingPhotoIDB] Cuota IndexedDB excedida', e);
    }
    throw e;
  }
}
