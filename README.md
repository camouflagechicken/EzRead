# EzRead

**Sovereign local reader with neural playback and spatial memory.**

EzRead is a premium, privacy-first web application designed for deep reading and listening. It allows you to upload your own documents, stores them locally in your browser, and provides a highly customizable, distraction-free reading environment with integrated Text-to-Speech (TTS).

## ✨ Features

*   📚 **Local Vault (Offline First):** Upload PDFs and TXT files. Your library is stored securely in your browser using native IndexedDB. No cloud accounts required.
*   🎧 **Neural Playback:** Integrated Text-to-Speech engine. Listen to your books with adjustable voice selection, reading speed, pitch, and volume.
*   🧠 **Spatial Memory:** EzRead automatically tracks your exact reading position. Close the app and return later to pick up exactly where you left off, complete with visual progress bars on your library cards.
*   🎯 **Focus Mode:** A toggleable "tunnel vision" effect that aggressively dims and blurs inactive text, forcing your eyes to stay locked on the current sentence.
*   ⚙️ **Typographic Calibration:** Fine-tune your reading experience with adjustable font sizes and reading column widths. Spacing scales perfectly with your typography.
*   💾 **Persistent Preferences:** Your typographic and audio settings are saved locally and automatically applied every time you open a book.
*   📱 **Fully Responsive:** Fluid grid layouts, overlay sidebars, and touch-optimized controls ensure a perfect experience on both desktop and mobile devices.

## 🛠 Tech Stack

*   **Framework:** React 18 + Vite
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion (`motion/react`)
*   **Icons:** Lucide React
*   **Storage:** Native IndexedDB (Zero dependencies)
*   **Audio:** Web Speech API
*   **PDF Parsing:** PDF.js (`pdfjs-dist`)

## 🚀 Getting Started

### Prerequisites
Ensure you have Node.js installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ezread
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` (or the port specified by Vite).

## 📖 Usage

1. **The Vault:** Upon opening the app, you will see the Library screen. You can choose from a selection of curated public domain classics or click the **Upload** card to add your own PDF or TXT file.
2. **Reading & Listening:** Click on any book to open the Reader. Use the bottom control bar to play, pause, or skip through the text.
3. **Calibration:** Click the **Settings (Cog)** icon in the top right to adjust your font size, column width, and audio preferences.
4. **Focus:** Click the **Target** icon next to the settings to toggle Focus Mode.
5. **Navigation:** Use the **Table of Contents** (left panel) or **Minimap** (right panel) to jump to specific sections of the text.

## 🔒 Privacy

EzRead is a "sovereign" application. When you upload a document to your Local Vault, it never leaves your device. All text extraction, storage, and progress tracking happen entirely client-side within your browser.
