/**
 * A short, repeated tone for a new or escalated SOS (UC-A03 step 2: sound as
 * well as a visual alert). Made with Web Audio, so there is no file to load.
 * Browsers only play sound after the page has been interacted with; signing
 * in counts.
 */
let context: AudioContext | null = null;

export function soundSosAlarm(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    const start = context.currentTime;
    // Three pairs of high-low beeps, about 2 seconds in all
    for (let i = 0; i < 6; i++) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'square';
      osc.frequency.value = i % 2 ? 660 : 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(context.destination);
      osc.start(start + i * 0.32);
      osc.stop(start + i * 0.32 + 0.22);
    }
  } catch {
    // No sound available; the red banner still shows
  }
}
