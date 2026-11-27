// Ridge Runner — sound, all synthesised with WebAudio: no audio files,
// no network. Engine hum follows throttle and speed, wind follows speed,
// a chime marks a ring, a thud marks a crash.

/** Create the sound engine. Nothing starts until a user gesture calls unlock(). */
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    muted: false,
    unlocked: false,
  };
}

/** Start the AudioContext after a gesture (browsers block it before one). */
export function unlockAudio(audio) {
  if (audio.unlocked) return;
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine: a sawtooth through a lowpass, pitched by throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Wind: looped white noise through a bandpass.
    const len = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    audio.windSrc = audio.ctx.createBufferSource();
    audio.windSrc.buffer = buffer;
    audio.windSrc.loop = true;
    const band = audio.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSrc.connect(band);
    band.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSrc.start();
    audio.unlocked = true;
  } catch {
    audio.unlocked = false;
  }
}

/** Continuous levels, called once per frame from the game state. */
export function updateAudio(audio, plane, flying) {
  if (!audio.unlocked || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const throttle = plane.throttle;
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + plane.speed * 0.5, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.06 : 0.0, t, 0.1);
  audio.windGain.gain.setTargetAtTime(flying ? Math.min(0.16, plane.speed * 0.0016) : 0.0, t, 0.15);
}

/** A short tone. */
function blip(audio, freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!audio.unlocked || !audio.ctx) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Two-note chime for a flown ring. */
export function ringChime(audio) {
  blip(audio, 880, 0.18, 'sine', 0.22, 0);
  blip(audio, 1318, 0.3, 'sine', 0.2, 0.09);
}

/** Low thud for a crash. */
export function crashThud(audio) {
  blip(audio, 70, 0.5, 'triangle', 0.5, 0);
  blip(audio, 48, 0.7, 'sine', 0.5, 0.05);
}

/** A click for menus and buttons. */
export function clickBlip(audio) {
  blip(audio, 620, 0.08, 'square', 0.08, 0);
}

/** Mute or unmute the master gain. */
export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}
