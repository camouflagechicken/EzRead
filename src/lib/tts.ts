export class TTSEngine {
  static currentUtterance: SpeechSynthesisUtterance | null = null;

  static getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices();
  }

  static speak(
    text: string,
    voice: SpeechSynthesisVoice | null,
    volume: number,
    rate: number,
    pitch: number,
    onEnd: () => void,
    onError: (e: any) => void
  ) {
    // Clear previous utterance callbacks to prevent race conditions
    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    if (!text.trim()) {
      onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.volume = volume;
    utterance.rate = rate; 
    utterance.pitch = pitch;

    utterance.onend = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
        onEnd();
      }
    };

    utterance.onerror = (e) => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
        console.error("TTS Error:", e);
        onError(e);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  static stop() {
    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
      this.currentUtterance = null;
    }
    window.speechSynthesis.cancel();
  }

  static pause() {
    window.speechSynthesis.pause();
  }

  static resume() {
    window.speechSynthesis.resume();
  }
}
