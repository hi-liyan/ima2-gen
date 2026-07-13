import type { EmbeddedGenerationMetadata, GenerateItem } from "../types";
import { readImageMetadata } from "../lib/api";
import { readFileAsDataURL } from "../lib/image";
import { compressToBase64, isHeic, isImageFile, hasAlphaChannel } from "../lib/compress";
import { parseRequestedCustomSide } from "../lib/size";
import { isImageModel } from "../lib/imageModels";
import { t } from "../i18n";
import {
  saveImageModel,
  isQuality,
  isFormat,
  isModeration,
  parseMetadataSize,
  saveGenerationDefaultsPatch,
} from "./storePersistence";
import { compressReferenceSource } from "./storeHelpers";
import {
  clearPersistedReferenceImages,
  savePersistedReferenceImages,
} from "./referenceImagePersistence";
import type { AppState, StoreSet, StoreGet } from "./storeTypes";
import type { ClientNodeId } from "../lib/graph";

function applyMetadataToState(
  state: AppState,
  metadata: EmbeddedGenerationMetadata,
): Partial<AppState> {
  const patch: Partial<AppState> = {};
  const prompt = metadata.userPrompt || metadata.prompt;
  if (typeof prompt === "string") patch.prompt = prompt;
  if (isQuality(metadata.quality)) patch.quality = metadata.quality;
  if (isFormat(metadata.format)) patch.format = metadata.format;
  if (isModeration(metadata.moderation)) patch.moderation = metadata.moderation;
  if (metadata.promptMode === "auto" || metadata.promptMode === "direct") {
    patch.promptMode = metadata.promptMode;
  }
  if (metadata.model && isImageModel(metadata.model)) {
    patch.imageModel = metadata.model;
  }
  const size = parseMetadataSize(metadata.size);
  if (size.preset) patch.sizePreset = size.preset;
  if (size.preset === "custom" && size.w && size.h) {
    patch.customW = parseRequestedCustomSide(size.w, state.customW);
    patch.customH = parseRequestedCustomSide(size.h, state.customH);
  }
  return patch;
}

export async function addReferencesImpl(
  files: File[],
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  const maxReferences = get().referenceLimit;
  const allowed = maxReferences - get().referenceImages.length;
  const toAdd = files.slice(0, Math.max(0, allowed));
  const results = await Promise.all(
    toAdd.map(async (f) => {
      try {
        return await compressToBase64(f, {
          preserveTransparency: hasAlphaChannel(f),
        });
      } catch (err) {
        console.warn("[addReferences] compress failed", err);
        return null;
      }
    }),
  );
  const valid = results.filter((x): x is string => !!x);
  const heicFailed = toAdd.some((file, index) => isHeic(file) && !results[index]);
  const otherFailed = toAdd.some((file, index) => !isHeic(file) && !results[index]);
  const state = get();
  const referenceImages = [...state.referenceImages, ...valid].slice(0, state.referenceLimit);
  set({
    referenceImages,
    providerUrlReference: valid.length > 0 ? null : state.providerUrlReference,
  });
  void savePersistedReferenceImages(referenceImages);
  if (heicFailed) get().showToast(t("toast.refHeicConversionFailed"), true);
  if (otherFailed) get().showToast(t("toast.refTooLarge"), true);
  if (files.length > allowed) get().showToast(t("toast.refLimitExceeded"), true);
}

export async function readDroppedImageMetadataImpl(
  file: File,
  targetNodeId: ClientNodeId | null,
  set: StoreSet,
  get: StoreGet,
): Promise<boolean> {
  if (isHeic(file) || !isImageFile(file)) return false;
  let dataUrl = "";
  try {
    dataUrl = await readFileAsDataURL(file);
    const result = await readImageMetadata({ filename: file.name, dataUrl });
    if (!result.metadata) return false;
    set({
      metadataRestore: {
        filename: file.name,
        image: dataUrl,
        metadata: result.metadata,
        source: result.source ?? "xmp",
        targetNodeId,
      },
    });
    return true;
  } catch {
    get().showToast(t("metadata.readFailed"), true);
    return false;
  }
}

export function applyMetadataRestoreImpl(set: StoreSet, get: StoreGet): void {
  const pending = get().metadataRestore;
  if (!pending) return;
  const patch = applyMetadataToState(get(), pending.metadata);
  if (patch.imageModel) saveImageModel(patch.imageModel);
  if (pending.targetNodeId && typeof patch.prompt === "string") {
    const prompt = patch.prompt;
    set({
      ...patch,
      metadataRestore: null,
      graphNodes: get().graphNodes.map((n) =>
        n.id === pending.targetNodeId
          ? { ...n, data: { ...n.data, prompt } }
          : n,
      ),
    });
    get().scheduleGraphSave();
  } else {
    set({ ...patch, metadataRestore: null });
  }
  get().showToast(t("metadata.applied"));
}

export function removeReferenceImpl(index: number, set: StoreSet, get: StoreGet): void {
  const state = get();
  const referenceImages = state.referenceImages.filter((_, i) => i !== index);
  const clearContinuity = referenceImages.length === 0;
  const insertedPrompts = clearContinuity
    ? state.insertedPrompts.filter((prompt) => !prompt.id.startsWith("video-continuity:"))
    : state.insertedPrompts;
  if (insertedPrompts.length !== state.insertedPrompts.length) {
    saveGenerationDefaultsPatch({ insertedPrompts });
  }
  set({
    referenceImages,
    insertedPrompts,
    videoContinuityLineage: clearContinuity ? null : state.videoContinuityLineage,
    canvasReferenceImage:
      state.referenceImages[index] === state.canvasReferenceImage ? null : state.canvasReferenceImage,
  });
  void savePersistedReferenceImages(referenceImages);
}

export function clearReferencesImpl(set: StoreSet, get: StoreGet): void {
  const insertedPrompts = get().insertedPrompts.filter((prompt) => !prompt.id.startsWith("video-continuity:"));
  if (insertedPrompts.length !== get().insertedPrompts.length) {
    saveGenerationDefaultsPatch({ insertedPrompts });
  }
  set({ referenceImages: [], canvasReferenceImage: null, videoContinuityLineage: null, insertedPrompts, providerUrlReference: null });
  void clearPersistedReferenceImages();
}

export async function attachCanvasVersionReferenceImpl(
  item: GenerateItem,
  set: StoreSet,
  get: StoreGet,
  overrideSource?: string,
): Promise<void> {
  let dataUrl: string;
  try {
    dataUrl = await compressReferenceSource(
      overrideSource ?? item.image,
      item.filename || "canvas-version-reference.png",
    );
  } catch {
    get().showToast(t("toast.currentImageLoadFailed"), true);
    throw new Error("canvas_reference_attach_failed");
  }
  const state = get();
  const withoutPrevious = state.canvasReferenceImage
    ? state.referenceImages.filter((ref) => ref !== state.canvasReferenceImage)
    : state.referenceImages;
  const withoutDuplicate = withoutPrevious.filter((ref) => ref !== dataUrl);
  const referenceImages = [dataUrl, ...withoutDuplicate].slice(0, state.referenceLimit);
  set({
    canvasReferenceImage: dataUrl,
    referenceImages,
    providerUrlReference: null,
  });
  void savePersistedReferenceImages(referenceImages);
  get().showToast(t("canvas.version.usingAsReference"));
}

// Canvas versions carry burned-in annotation pixels for UI display. Model
// payloads must use the clean source instead (policy from #96): resolve a
// canvas-version item to its original file before attaching it as a reference.
function resolveModelReferenceSrc(item: GenerateItem): string {
  if (item.canvasVersion && item.canvasSourceFilename) {
    return `/generated/${encodeURIComponent(item.canvasSourceFilename)}`;
  }
  return item.image;
}

export async function useCurrentAsReferenceImpl(set: StoreSet, get: StoreGet): Promise<void> {
  const cur = get().currentImage;
  if (!cur) {
    get().showToast(t("toast.noCurrentImageForRef"), true);
    return;
  }
  if (get().referenceImages.length >= get().referenceLimit) {
    get().showToast(t("toast.refSlotFull"), true);
    return;
  }
  let dataUrl: string;
  try {
    dataUrl = await compressReferenceSource(
      resolveModelReferenceSrc(cur),
      cur.canvasSourceFilename || cur.filename || "current-reference.png",
    );
  } catch {
    get().showToast(t("toast.currentImageLoadFailed"), true);
    return;
  }
  const referenceImages = [...get().referenceImages, dataUrl].slice(0, get().referenceLimit);
  set({ referenceImages, providerUrlReference: null });
  void savePersistedReferenceImages(referenceImages);
  get().showToast(t("toast.addedCurrentAsRef"));
}

export async function useImageAsReferenceImpl(
  item: GenerateItem,
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  if (get().referenceImages.length >= get().referenceLimit) {
    get().showToast(t("toast.refSlotFull"), true);
    return;
  }
  let dataUrl: string;
  try {
    dataUrl = await compressReferenceSource(
      resolveModelReferenceSrc(item),
      item.canvasSourceFilename || item.filename || "canvas-reference.png",
    );
  } catch {
    get().showToast(t("toast.currentImageLoadFailed"), true);
    return;
  }
  const referenceImages = [...get().referenceImages, dataUrl].slice(0, get().referenceLimit);
  set({ referenceImages, providerUrlReference: null });
  void savePersistedReferenceImages(referenceImages);
  get().showToast(t("toast.addedCurrentAsRef"));
}
