// OPENI AI whisper models converted to ggml format and hosted on hugging face

import { Directory, File, Paths } from "expo-file-system";
import { DownloadProgressData, FileSystemDownloadResult, createDownloadResumable } from "expo-file-system/legacy";
import { useCallback, useState } from "react";
import type { WhisperContext } from "whisper.rn/index.js";
import { initWhisper } from "whisper.rn/index.js";


export interface WhisperModel {
    id:string;
    label:string;
    url:string;
    filename:string;
    capabilities:{
        multilingual:boolean;
        quantizable:boolean;
        tdrz?:boolean; // optional TDRZ capability for native models
    }
}

interface ModelFileInfo {
    path:string;
    size:number;
}

export const WHISPER_MODELS:WhisperModel[] = [
    {
        id: "tiny",
        label: "Tiny Model",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        filename: "ggml-tiny-bin",
        capabilities: {
            multilingual: true,
            quantizable: false,
            tdrz: undefined
        }
    },
    {
        id: "tiny (en)",
        label: "Tiny English Model",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-en.bin",
        filename: "ggml-tiny-en.bin",
        capabilities: {
            multilingual: true,
            quantizable: false,
            tdrz: undefined
        }
    },
    {
        id: "base",
        label: "Base Model",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        filename: "ggml-base.bin",
        capabilities: {
            multilingual: true,
            quantizable: false,
            tdrz: undefined
        }
    },
    {
        id: "small",
        label: "Small Model",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        filename: "ggml-small.bin",
        capabilities: {
            multilingual: true,
            quantizable: false,
            tdrz: undefined
        }   
    },
]

export function useWhisperModel() {

    const [initializingModel, setInitializingModel] = useState(false);
    const [modelFiles, setModelFiles] = useState<Record<string, ModelFileInfo>>({}); // cache of model file info by model ID

    const [isDownloading, setIsDownloading] = useState(false); // downloading state
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({}); // download progress by model ID

    const [WhisperContext, setWhisperContext] = useState<WhisperContext | null>(null); // Whisper context coming from ⬆️
    const [vadContext, setVadContext] = useState<any>(null);
    const [CurrentModelId, setCurrentModelId] = useState<string | null>(null);

    async function getModelDirectory(){
        let documentsDirectory: Directory;
        try {
            documentsDirectory = Paths.document; // paths from expo file system
        } catch (e) {
            console.log(e);
            throw new Error("Document directory is not available.")
        }

        const directory = new Directory(documentsDirectory, "whisper-models") // new Directory from efs
        directory.create({ idempotent: true, intermediates: true}) 
        // safe to call multiple times without error + Whether to create intermediate directories if they do not exist
        return directory
    }

    async function downloadModel(model:WhisperModel) {
        const directory = await getModelDirectory();
        const file = new File(directory, model.filename);

        // helper function to update cache with latest stat info
        const updateModelFileInfo = async () => {
            try {
                const stats = await file.info();
                if(!stats.exists) throw new Error("File not found");
                setModelFiles((prev) => ({
                    ...prev,
                    [model.id]: {   
                        path: file.uri,
                        size: Number(stats.size) || 0,
                    } 
                }))
            } catch(statError) {
                console.warn(`Failed to stat model file ${model.id} at ${file.uri}:`, statError);
                setModelFiles((prev) => ({
                    ...prev, 
                    [model.id]: {
                        path: file.uri,
                        size: 0, // default size if stat fails
                    }
                }))
            }
        }

        // check if file already exists
        let existingInfo;
        try {
            existingInfo = file.info();
        } catch (infoError) {
            console.warn(`Failed to read info for model ${model.id} at ${file.uri}:`, infoError);
            existingInfo = {exists: false};
        }

        if (existingInfo.exists) {
            console.log(`Model ${model.id} already exists at ${file.uri}`);
            updateModelFileInfo();
            return file.uri;
        }

        // download the model file
        setIsDownloading(true);
        console.log(`Downloading model ${model.id} from ${model.url}`);
        try { 
            const downloadResumable = createDownloadResumable( // create a resumable download
                model.url, // remote URL
                file.uri, // local file URI
                undefined, // options
                (progressData: DownloadProgressData) => { // progress callback
                    const { totalBytesWritten, totalBytesExpectedToWrite } = progressData; // bytes written and expected
                    const fraction = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0; // calculate fraction
                    setDownloadProgress((prev) => ({
                        ...prev,
                        [model.id]: fraction,
                    }));
                    console.log(`Downlod progress for ${model.id}: ${(fraction * 100).toFixed(1)}%`);
                }
            )

            const downloadResult = (await downloadResumable.downloadAsync()) as 
                | FileSystemDownloadResult 
                | undefined;

            if (
                downloadResult && 
                (downloadResult.status === 0 || 
                    (downloadResult.status >= 200 && downloadResult.status < 300))
            ) {
                console.log(`Successfully downloaded model ${model.id}`);
                updateModelFileInfo();
                setDownloadProgress((prev) => ({...prev, [model.id]: 1 }));
                return file.uri;
            } else {
                throw new Error (
                    `Download failed with status: ${downloadResult?.status}`
                );
            }
        } catch (error) {
            console.error(`Error downloading model ${model.id}:`, error);
            throw error;
        } finally {
            setIsDownloading(false)
        }
    }


    async function initializeModel(modelId:string){
        const model = WHISPER_MODELS.find((m) => m.id === modelId);

        if(!model){ // fallback if model not found
                throw new Error(`Model with id ${modelId} not found`);
        }
        try {
            setInitializingModel(true);
            // Download and initialize the model here
            const modelPath = await downloadModel(model); 

            // Initialize whisper context from now
            const context = await initWhisper({
                filePath: modelPath,
            });

            // set state variable
            setWhisperContext(context);
            setCurrentModelId(modelId);
            console.log(`Whisper context initialized for model: ${model.label}`);

            // return
            return {
                WhisperContext: context, 
                vadContext: null,
            }

        } catch (error) {
            console.error("Error initializing model:", error);  
        }finally {
            setInitializingModel(false);
        }  
        
    }

    const getModelById = useCallback((modelId: string) => { 
        return WHISPER_MODELS.find((m) => m.id === modelId); 
    }, []); 

    const getCurrentModel = useCallback(() => {
        return CurrentModelId ? getModelById(CurrentModelId): null;
    }, [CurrentModelId, getModelById]);

    const isModelDownloaded = useCallback((modelId: string) => {
        return modelFiles[modelId] !== undefined;
    }, [modelFiles])

    const getDownloadProgress = useCallback((modelId: string) => {
        return downloadProgress[modelId] || 0;
    }, [downloadProgress])


    return {
        // states
        modelFiles,
        isDownloading,
        initializingModel,
        WhisperContext,
        vadContext,
        CurrentModelId,

        // actions
        downloadModel,
        initializeModel,
        // resetWhisperContext,
        // deleteModel,

        // helpers
        getModelById,
        getCurrentModel,
        isModelDownloaded,
        getDownloadProgress,

        availableModels: WHISPER_MODELS
    }
}





