# Whisper RN Local Transcription App

A React Native + Expo project that brings **offline Whisper speech-to-text** to mobile devices using the **whisper.rn** native module. This app downloads Whisper models locally, initializes them on-device, and performs completely offline transcription.

---

## 🚀 Features

* 🎤 **Offline transcription** using whisper.rn
* 📦 Local model downloading (base, small, medium, large)
* 🧠 VAD (voice activity detection) support
* 📊 Real‑time status updates (download %, initialized status, etc.)
* ⚡ Designed for **Expo Dev Client** or **native builds** (NOT Expo Go)

---

## ⚠ Important Notes

### ❌ Whisper **does NOT run on Expo Go**

## 🧩 Core Logic

### Model Initialization Flow

1. User opens the app
2. `HomeScreen` calls `initializeWhisperModel("base")`
3. `useWhisperModels`:

   * Checks if the model already exists
   * Downloads it if missing
   * Loads the native Whisper model using whisper.rn
4. Whisper is now **ready for offline transcription**

---
