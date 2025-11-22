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

You must:

* Create an Expo Dev Client, or
* Build a full native app

Because `whisper.rn` is a native module and needs to be compiled.

### ✅ Works on:

* `expo-dev-client`
* `eas build`
* Bare React Native

---

## 📁 Project Structure

```
project-root/
├── app/
│   └── HomeScreen.tsx
├── hooks/
│   └── use-whisper-model.ts
├── components/
│   ├── themed-text.tsx
│   └── themed-view.tsx
├── README.md
└── package.json
```

---

## 🛠 Installation

### 1. Install dependencies

```sh
yarn install
```

### 2. Install Expo Dev Client

```sh
yarn expo install expo-dev-client
```

### 3. Install whisper.rn

```sh
yarn add whisper.rn
```

### 4. Rebuild dev client (required for native modules)

```sh
yarn expo run:ios
# or
yarn expo run:android
```

---

## ▶ Running the App

Start Metro:

```sh
yarn expo start
```

Open using the **Dev Client**, NOT Expo Go.

---

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

## 📌 Example: HomeScreen Code

```ts
useEffect(() => {
  initializeModel();
}, []);
```

This ensures the model is initialized on app load.

---

## 🧪 Testing

* Make sure the dev client is installed
* Use logs to confirm:

```
Model downloaded
Model initialized successfully
```

---

## 🐞 Common Errors

### ❌ Error: `Native module 'whisper.rn' not available in this runtime (Expo Go)`

Fix:

* Do **NOT** open the app in Expo Go
* Run:

```sh
yarn expo run:android
yarn expo run:ios
```

* Then open in the newly installed **dev client**

---

## 📦 Build APK / IPA

Using EAS:

```sh
yarn expo build:android
```

Or iOS:

```sh
yarn expo build:ios
```

---

## 📝 Roadmap

* [ ] Add UI for recording audio
* [ ] Live speech-to-text view
* [ ] Local storage for transcripts
* [ ] Model selector (base → large)

---

## 🤝 Contributing

Pull requests are welcome.

---

## 📄 License

MIT
