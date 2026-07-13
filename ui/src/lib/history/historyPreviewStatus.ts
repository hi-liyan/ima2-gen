import type { GenerateItem } from "../../types";
import { getGalleryItemKey } from "../galleryNavigation";
import { SEEN_HISTORY_ITEM_KEYS_STORAGE_KEY } from "../../store/persistenceRegistry";

/** 读取已经由用户主动预览过的历史图片键。 */
export function loadSeenHistoryItemKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_HISTORY_ITEM_KEYS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

/** 将已预览图片键持久化，页面刷新后继续保留已读状态。 */
export function saveSeenHistoryItemKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(SEEN_HISTORY_ITEM_KEYS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* 本地存储不可用时，当前会话内的已读状态仍然有效。 */
  }
}

/** 判断历史图片是否还没有被用户主动预览。 */
export function isHistoryItemUnseen(item: GenerateItem, seenKeys: Set<string>): boolean {
  return !seenKeys.has(getGalleryItemKey(item));
}

/** 为用户刚刚预览的图片生成新的已读键集合。 */
export function markHistoryItemsAsSeen(items: GenerateItem[], seenKeys: Set<string>): Set<string> {
  const next = new Set(seenKeys);
  for (const item of items) next.add(getGalleryItemKey(item));
  saveSeenHistoryItemKeys(next);
  return next;
}
