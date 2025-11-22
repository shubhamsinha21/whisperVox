/**
 * Safe, patched version of useWhisperModels
 * - dynamic native import (no crash on Expo Go)
 * - awaited fs calls
 * - guarded VAD init & release
 * - resumable download + progress
 */

import { Directory, File, Paths } from "expo-file-system";
import {
    createDownloadResumable,
    type DownloadProgressData,
    type FileSystemDownloadResult,
} from "expo-file-system/legacy";
import { useCallback, useEffect, useState } from "react";
// keep the type import only (erased at runtime)
import type { WhisperContext } from "whisper.rn/index.js";

export interface WhisperModel {
  id: string;
  label: string;
  url: string;
  filename: string;
  capabilities: {
    multilingual: boolean;
    quantizable: boolean;
    tdrz?: boolean;
  };
}

interface ModelFileInfo {
  path: string;
  size: number;
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "large-v3-turbo",
    label: "Large Multilanguae",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    filename: "ggml-large-v3-turbo.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "tiny-en",
    label: "Tiny (en)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    filename: "ggml-tiny.en.bin",
    capabilities: { multilingual: false, quantizable: false },
  },
  {
    id: "base",
    label: "Base Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    filename: "ggml-base.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "small",
    label: "Small Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    filename: "ggml-small.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "small-tdrz",
    label: "Small (tdrz)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-tdrz.bin",
    filename: "ggml-small.en-tdrz.bin",
    capabilities: { multilingual: false, quantizable: false, tdrz: true },
  },
];

/**
 * Dynamic loader for the native whisper module.
 * Returns the module object if available, otherwise null (no crash).
 */
async function loadWhisperNative(): Promise<any | null> {
  try {
    const mod = await import("whisper.rn/index.js");
    if (!mod || typeof mod.initWhisper !== "function") {
      throw new Error("initWhisper export missing");
    }
    return mod;
  } catch (err) {
    // Friendly warning — don't crash in Expo Go
    console.warn(
      "whisper.rn native module not available (Expo Go?). To use native features build a dev client or a native app.",
      err
    );
    return null;
  }
}

export function useWhisperModels() {
  // state (aligned with Code 1 naming)
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileInfo>>(
    {}
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, number>
  >({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializingModel, setIsInitializingModel] = useState(false);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null
  );
  const [vadContext, setVadContext] = useState<any>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);

  // Ensure model directory exists
  const getModelDirectory = useCallback(async () => {
    let documentDirectory: Directory;
    try {
      documentDirectory = Paths.document;
    } catch (error) {
      throw new Error("Document directory is not available.");
    }

    if (!documentDirectory?.uri) {
      throw new Error("Document directory is not available.");
    }

    const directory = new Directory(documentDirectory, "whisper-models");
    try {
      // await create in case it's async
      // (some implementations return a promise)
      if (typeof directory.create === "function") {
        // awaiting in case create returns a promise
        // (safe even if create is synchronous)
        // @ts-ignore - some typings might not reflect Promise return
        await directory.create({ idempotent: true, intermediates: true });
      }
    } catch (error) {
      console.warn("Failed to ensure Whisper model directory exists:", error);
      throw error;
    }
    return directory;
  }, []);

  // Download model with resumable support
  const downloadModel = useCallback(
    async (model: WhisperModel) => {
      const directory = await getModelDirectory();
      const file = new File(directory, model.filename);

      // update cache with latest stat info
      const updateModelFileInfo = async () => {
        try {
          const stats = await file.info();
          if (!stats.exists) throw new Error("File not found");
          setModelFiles((prev) => ({
            ...prev,
            [model.id]: {
              path: file.uri,
              size: Number(stats.size) || 0,
            },
          }));
        } catch (statError) {
          console.warn(
            `Failed to stat model file ${model.id} at ${file.uri}:`,
            statError
          );
          setModelFiles((prev) => ({
            ...prev,
            [model.id]: {
              path: file.uri,
              size: 0,
            },
          }));
        }
      };

      // Check if file already exists (await info)
      let existingInfo;
      try {
        existingInfo = await file.info();
      } catch (infoError) {
        console.warn(
          `Failed to read info for model ${model.id} at ${file.uri}:`,
          infoError
        );
        existingInfo = { exists: false };
      }
      if (existingInfo.exists) {
        console.log(`Model ${model.id} already exists at ${file.uri}`);
        await updateModelFileInfo();
        return file.uri;
      }

      setIsDownloading(true);
      console.log(`Downloading model ${model.id} from ${model.url}`);

      try {
        const downloadResumable = createDownloadResumable(
          model.url,
          file.uri,
          undefined,
          (progressData: DownloadProgressData) => {
            const { totalBytesWritten, totalBytesExpectedToWrite } = progressData;
            const fraction =
              totalBytesExpectedToWrite > 0
                ? totalBytesWritten / totalBytesExpectedToWrite
                : 0;
            setDownloadProgress((prev) => ({
              ...prev,
              [model.id]: fraction,
            }));
            console.log(
              `Download progress for ${model.id}: ${(fraction * 100).toFixed(
                1
              )}%`
            );
          }
        );

        const downloadResult = (await downloadResumable.downloadAsync()) as
          | FileSystemDownloadResult
          | undefined;

        if (
          downloadResult &&
          (downloadResult.status === 0 ||
            (downloadResult.status >= 200 && downloadResult.status < 300))
        ) {
          console.log(`Successfully downloaded model ${model.id}`);
          await updateModelFileInfo();
          setDownloadProgress((prev) => ({ ...prev, [model.id]: 1 }));
          return file.uri;
        } else {
          throw new Error(
            `Download failed with status: ${downloadResult?.status}`
          );
        }
      } catch (error) {
        console.error(`Error downloading model ${model.id}:`, error);
        throw error;
      } finally {
        setIsDownloading(false);
      }
    },
    [getModelDirectory]
  );

  // Initialize model (safe dynamic import + optional VAD)
  const initializeWhisperModel = useCallback(
    async (modelId: string, options?: { initVad?: boolean }) => {
      const model = WHISPER_MODELS.find((m) => m.id === modelId);
      if (!model) throw new Error("Invalid model selected");

      try {
        setIsInitializingModel(true);
        console.log(`Initializing Whisper model: ${model.label}`);

        // Ensure model is downloaded
        const modelPath = await downloadModel(model);

        // Attempt to load native module dynamically
        const whisperNative = await loadWhisperNative();
        if (!whisperNative) {
          // Return or throw - throwing makes caller handle it
          throw new Error(
            "Native module 'whisper.rn' not available in this runtime (Expo Go). Create a dev client or run a native build to use native features."
          );
        }

        // Initialize Whisper context via native module
        const context: WhisperContext = await whisperNative.initWhisper({
          filePath: modelPath,
        });

        setWhisperContext(context);
        setCurrentModelId(modelId);
        console.log(`Whisper context initialized for model: ${model.label}`);

        // Optionally initialize VAD
        if (options?.initVad) {
          console.log("Initializing VAD context...");
          try {
            if (typeof whisperNative.initWhisperVad === "function") {
              const vad = await whisperNative.initWhisperVad({ filePath: modelPath });
              setVadContext(vad);
              console.log("VAD context initialized successfully");
            } else {
              console.warn("initWhisperVad not available on native module");
            }
          } catch (vadError) {
            console.warn("VAD initialization failed:", vadError);
            // Continue without VAD
          }
        }

        return {
          whisperContext: context,
          vadContext: options?.initVad ? vadContext : null,
        };
      } catch (error) {
        console.error("Model initialization error:", error);
        throw error;
      } finally {
        setIsInitializingModel(false);
      }
    },
    [downloadModel, vadContext]
  );

  // Reset contexts
  const resetWhisperContext = useCallback(() => {
    setWhisperContext(null);
    setVadContext(null);
    setCurrentModelId(null);
    console.log("Whisper contexts reset");
  }, []);

  // Helpers
  const getModelById = useCallback((modelId: string) => {
    return WHISPER_MODELS.find((m) => m.id === modelId);
  }, []);

  const getCurrentModel = useCallback(() => {
    return currentModelId ? getModelById(currentModelId) : null;
  }, [currentModelId, getModelById]);

  const isModelDownloaded = useCallback(
    (modelId: string) => {
      return modelFiles[modelId] !== undefined;
    },
    [modelFiles]
  );

  const getDownloadProgress = useCallback(
    (modelId: string) => {
      return downloadProgress[modelId] || 0;
    },
    [downloadProgress]
  );

  // Delete model and release context if needed
  const deleteModel = useCallback(
    async (modelId: string) => {
      const fileInfo = modelFiles[modelId];
      if (!fileInfo) {
        console.warn(`Attempted to delete non-downloaded model: ${modelId}`);
        return;
      }

      try {
        const file = new File(fileInfo.path);
        const info = await file.info();
        if (info.exists) {
          await file.delete();
          console.log(`Deleted model file at ${fileInfo.path}`);
        }
      } catch (error) {
        console.error(`Failed to delete model ${modelId}:`, error);
        throw error;
      }

      setModelFiles((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });

      if (currentModelId === modelId) {
        if (whisperContext?.release) {
          try {
            // release may be async
            await (whisperContext as any).release();
          } catch (releaseError) {
            console.warn(
              "Failed to release Whisper context during model deletion:",
              releaseError
            );
          }
        }
        setWhisperContext(null);
        setCurrentModelId(null);
        setVadContext(null);
      }
    },
    [currentModelId, modelFiles, whisperContext]
  );

  // On mount: scan existing files in model directory
  useEffect(() => {
    let isMounted = true;

    const loadExistingModels = async () => {
      try {
        const directory = await getModelDirectory();
        const entries = await Promise.all(
          WHISPER_MODELS.map(async (model) => {
            const file = new File(directory, model.filename);
            try {
              const fileInfo = await file.info();
              if (!fileInfo.exists) return null;

              return {
                id: model.id,
                info: {
                  path: file.uri,
                  size: Number(fileInfo.size) || 0,
                },
              } as { id: string; info: ModelFileInfo };
            } catch (statError) {
              console.warn(
                `Failed to stat existing model file ${model.id}:`,
                statError
              );
              return {
                id: model.id,
                info: {
                  path: file.uri,
                  size: 0,
                },
              };
            }
          })
        );

        if (!isMounted) return;

        const fileMap: Record<string, ModelFileInfo> = {};
        entries.forEach((entry) => {
          if (entry) {
            fileMap[entry.id] = entry.info;
          }
        });

        if (Object.keys(fileMap).length > 0) {
          setModelFiles((prev) => ({ ...prev, ...fileMap }));
        }
      } catch (error) {
        console.warn("Failed to load existing Whisper models:", error);
      }
    };

    loadExistingModels();

    return () => {
      isMounted = false;
    };
  }, [getModelDirectory]);

  return {
    // State
    modelFiles,
    downloadProgress,
    isDownloading,
    isInitializingModel,
    whisperContext,
    vadContext,
    currentModelId,

    // Actions
    downloadModel,
    initializeWhisperModel,
    resetWhisperContext,
    deleteModel,

    // Helpers
    getModelById,
    getCurrentModel,
    isModelDownloaded,
    getDownloadProgress,

    // Constants
    availableModels: WHISPER_MODELS,
  };
}
