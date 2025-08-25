class VADProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.prevSpeaking = false;
    this.lastChange = currentTime * 1000;
    this.noiseDb = -100;
    this.thresholdDb = 12; // default, can be updated via port
    this.hangoverMs = 200;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.thresholdDb === 'number') this.thresholdDb = d.thresholdDb;
      if (typeof d.hangoverMs === 'number') this.hangoverMs = d.hangoverMs;
    };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch = input[0];
    let s = 0.0;
    for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
    const rms = Math.sqrt(s / ch.length);
    const db = 20 * Math.log10(rms + 1e-9);
    const alpha = db < this.noiseDb ? 0.1 : 0.01;
    this.noiseDb = this.noiseDb * (1 - alpha) + db * alpha;
    const isSpeech = db > this.noiseDb + this.thresholdDb;
    const nowMs = currentTime * 1000;
    if (!this.prevSpeaking && isSpeech) {
      this.prevSpeaking = true;
      this.lastChange = nowMs;
      this.port.postMessage({ type: 'speech_start', tMs: nowMs });
    } else if (this.prevSpeaking && !isSpeech) {
      if (nowMs - this.lastChange > this.hangoverMs) {
        this.prevSpeaking = false;
        this.lastChange = nowMs;
        this.port.postMessage({ type: 'speech_end', tMs: nowMs });
      }
    }
    return true;
  }
}

registerProcessor('vad-processor', VADProcessor);

