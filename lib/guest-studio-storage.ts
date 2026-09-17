import type { GuestPhoto, GuestTransfer } from "./guest-studio";
import type { Row } from "./client";

const databaseName = "menu-material-photo-studio";
const lifetime = 24 * 60 * 60 * 1000;
type StoredPhoto = { file: File; normalized: Blob };
export type GuestDraftRecord = {
  id: string;
  savedAt: number;
  expiresAt: number;
  draft: Row;
  photo: StoredPhoto | null;
  reference: StoredPhoto | null;
  transfer: GuestTransfer | null;
  requested: boolean;
};
async function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("drafts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || Error("Local storage is unavailable."));
    request.onblocked = () =>
      reject(Error("Close other Photo Studio tabs to save this draft."));
  });
}
async function access<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("drafts", mode);
      const request = action(transaction.objectStore("drafts"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(
          transaction.error || Error("The local draft could not be saved."),
        );
      transaction.onerror = () =>
        reject(
          transaction.error || Error("The local draft could not be saved."),
        );
    });
  } finally {
    db.close();
  }
}
export async function loadGuestDrafts() {
  const records = await access<GuestDraftRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  const now = Date.now();
  for (const record of records)
    if (record.expiresAt <= now) await clearGuestDraft(record.id);
  return records
    .filter((record) => record.expiresAt > now)
    .sort((a, b) => b.savedAt - a.savedAt);
}
export async function saveGuestDraft(
  id: string,
  value: {
    draft: Row;
    photo: GuestPhoto | null;
    reference: GuestPhoto | null;
    transfer: GuestTransfer | null;
    requested: boolean;
  },
) {
  const photo = (photo: GuestPhoto | null): StoredPhoto | null =>
    photo ? { file: photo.file, normalized: photo.normalized } : null;
  const record: GuestDraftRecord = {
    ...value,
    id,
    savedAt: Date.now(),
    expiresAt: Date.now() + lifetime,
    photo: photo(value.photo),
    reference: photo(value.reference),
  };
  await access("readwrite", (store) => store.put(record));
  return record.expiresAt;
}
export async function clearGuestDraft(id: string) {
  await access("readwrite", (store) => store.delete(id));
}
export function restoreGuestPhoto(
  photo: StoredPhoto | null,
): GuestPhoto | null {
  return photo
    ? { ...photo, url: URL.createObjectURL(photo.normalized) }
    : null;
}
