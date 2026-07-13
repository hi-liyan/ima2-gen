import { COMPOSER_REFERENCE_IMAGES_STORAGE_KEY } from "./persistenceRegistry";

const REFERENCE_IMAGE_STORE = "references";
const REFERENCE_IMAGE_RECORD_KEY = "active";
const REFERENCE_IMAGE_DATABASE_VERSION = 1;

function openReferenceImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(
      COMPOSER_REFERENCE_IMAGES_STORAGE_KEY,
      REFERENCE_IMAGE_DATABASE_VERSION,
    );
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(REFERENCE_IMAGE_STORE)) {
        request.result.createObjectStore(REFERENCE_IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function normalizeReferenceImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.startsWith("data:image/"));
}

/** 读取主提示词编辑器已保存的参考图片，损坏或不可用时安全回退为空数组。 */
export async function loadPersistedReferenceImages(): Promise<string[]> {
  let database: IDBDatabase | null = null;
  try {
    database = await openReferenceImageDatabase();
    const transaction = database.transaction(REFERENCE_IMAGE_STORE, "readonly");
    const request = transaction.objectStore(REFERENCE_IMAGE_STORE).get(REFERENCE_IMAGE_RECORD_KEY);
    const value = await readRequest(request);
    await completeTransaction(transaction);
    return normalizeReferenceImages(value);
  } catch {
    return [];
  } finally {
    database?.close();
  }
}

/** 将当前主提示词编辑器参考图片写入浏览器本地 IndexedDB。 */
export async function savePersistedReferenceImages(referenceImages: string[]): Promise<void> {
  let database: IDBDatabase | null = null;
  try {
    database = await openReferenceImageDatabase();
    const transaction = database.transaction(REFERENCE_IMAGE_STORE, "readwrite");
    transaction.objectStore(REFERENCE_IMAGE_STORE).put(
      normalizeReferenceImages(referenceImages),
      REFERENCE_IMAGE_RECORD_KEY,
    );
    await completeTransaction(transaction);
  } catch {
    // IndexedDB 不可用或容量不足时，不影响当前页面的图片编辑流程。
  } finally {
    database?.close();
  }
}

/** 清空主提示词编辑器持久化的参考图片。 */
export async function clearPersistedReferenceImages(): Promise<void> {
  let database: IDBDatabase | null = null;
  try {
    database = await openReferenceImageDatabase();
    const transaction = database.transaction(REFERENCE_IMAGE_STORE, "readwrite");
    transaction.objectStore(REFERENCE_IMAGE_STORE).delete(REFERENCE_IMAGE_RECORD_KEY);
    await completeTransaction(transaction);
  } catch {
    // 清理失败时保持页面状态，下一次成功写入会覆盖旧记录。
  } finally {
    database?.close();
  }
}
