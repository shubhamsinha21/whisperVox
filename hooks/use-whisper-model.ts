// OPENI AI whisper models converted to ggml format and hosted on hugging face

import { useState } from "react";


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
    async function initializeModel(modelId:string){
        const model = WHISPER_MODELS.find((m) => m.id === modelId);

        if(!model){ // fallback if model not found
                throw new Error(`Model with id ${modelId} not found`);
        }

        try {
            setInitializingModel(true);
            // Download and initialize the model here
        } catch (error) {
            console.error("Error initializing model:", error);  
        }finally {
            setInitializingModel(false);
        }  
        
    }
}



