/**
 * AudioCoach & Sound Synthesizer
 * Uses Web Audio API for zero-latency synthesized sound effects and
 * Web Speech API for real-time voice coaching cues.
 */

class AudioCoach {
  constructor() {
    this.audioCtx = null;
    this.voiceEnabled = true;
    this.sfxEnabled = true;
    this.lang = 'en';
    this.speechSynth = window.speechSynthesis || null;
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
    this.speechCooldownMs = 2800; // Do not repeat same warning within 2.8 seconds
    this.selectedVoice = null;
    this.teluguVoice = null;

    this.initAudioContext();
    this.initSpeechVoice();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported on this browser', e);
    }
  }

  ensureContextRunning() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  initSpeechVoice() {
    if (!this.speechSynth) return;
    const loadVoices = () => {
      const voices = this.speechSynth.getVoices();
      // Prefer clear natural English voice
      this.selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira'))) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      // Check for Telugu voice
      this.teluguVoice = voices.find(v => v.lang.startsWith('te') || v.lang.includes('te-IN')) || null;
    };
    loadVoices();
    if (this.speechSynth.onvoiceschanged !== undefined) {
      this.speechSynth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Speak coaching feedback via Web Speech API
   * @param {string} text - The spoken coaching cue
   * @param {boolean} force - Whether to override cooldown (e.g. rep counter)
   */
  speak(text, force = false) {
    if (!this.voiceEnabled || !this.speechSynth || !text) return;

    const now = Date.now();
    if (!force && text === this.lastSpokenText && (now - this.lastSpokenTime) < this.speechCooldownMs) {
      return;
    }

    try {
      // Cancel previous speech if urgent cue
      if (force) {
        this.speechSynth.cancel();
      } else if (this.speechSynth.speaking) {
        return; // Don't interrupt if already talking
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.lang === 'te' && this.teluguVoice) {
        utterance.voice = this.teluguVoice;
      } else if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // Slightly energetic pacing
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      this.lastSpokenText = text;
      this.lastSpokenTime = now;

      this.speechSynth.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  }

  /**
   * Synthesize an upbeat double-chime when a rep is successfully counted
   */
  playRepSuccessSound() {
    if (!this.sfxEnabled) return;
    this.ensureContextRunning();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    // First tone (523.25 Hz - C5)
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second higher tone (783.99 Hz - G5)
    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(783.99, now + 0.08);
    gain2.gain.setValueAtTime(0.25, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.audioCtx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  }

  /**
   * Synthesize a low frequency warning buzz for wrong posture
   */
  playWarningSound() {
    if (!this.sfxEnabled) return;
    this.ensureContextRunning();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.2);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Synthesize short countdown beep
   */
  playCountdownBeep(isFinal = false) {
    if (!this.sfxEnabled) return;
    this.ensureContextRunning();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    const freq = isFinal ? 880 : 440;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.3 : 0.15));

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + (isFinal ? 0.3 : 0.15));
  }

  toggleVoice(enabled) {
    this.voiceEnabled = enabled;
    return this.voiceEnabled;
  }

  toggleSfx(enabled) {
    this.sfxEnabled = enabled;
    return this.sfxEnabled;
  }
}

// Global instance
window.audioCoach = new AudioCoach();
