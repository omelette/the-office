/**
 * Pure Web Audio API synthesis soundscape for Dumbledore's Office (CoS Ch. 12:
 * "a large and beautiful circular room, full of funny little noises").
 *
 * Lazily instantiates AudioContext ONLY on explicit user toggle/interaction so
 * zero browser autoplay warnings are emitted on page load.
 */

function safeNow(ctx) {
  return ctx ? ctx.currentTime : 0;
}

function createNoiseBuffer(ctx, durationSec = 2.5) {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Subtle pink-tinted noise so ambient puffs/hearth stay warm and non-harsh
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.16;
    data[i] = Math.max(-1, Math.min(1, pink));
  }
  return buffer;
}

export function createSoundscape() {
  let ctx = null;
  let masterGain = null;
  let ambientGain = null;
  let sfxGain = null;
  let hearthGain = null;
  let noiseBuffer = null;

  let enabled = false;
  let disposed = false;
  let fireplaceLit = true;

  /** @type {Set<number>} */
  const activeTimers = new Set();
  /** @type {{ stop: () => void }[]} */
  let continuousNodes = [];

  function registerTimer(fn, delayMs) {
    if (disposed) return null;
    const id = setTimeout(() => {
      activeTimers.delete(id);
      if (!disposed && enabled) {
        fn();
      }
    }, delayMs);
    activeTimers.add(id);
    return id;
  }

  function clearAllTimers() {
    for (const id of activeTimers) {
      clearTimeout(id);
    }
    activeTimers.clear();
  }

  function stopContinuousBed() {
    for (const handle of continuousNodes) {
      try {
        handle.stop();
      } catch (_) {
        // Ignore already stopped audio nodes
      }
    }
    continuousNodes = [];
  }

  function ensureContext() {
    if (disposed) return null;
    if (ctx) return ctx;

    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!AudioCtx) return null;

    ctx = new AudioCtx();
    noiseBuffer = createNoiseBuffer(ctx, 2.5);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;
    compressor.connect(ctx.destination);

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(compressor);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.24;
    ambientGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.45;
    sfxGain.connect(masterGain);

    hearthGain = ctx.createGain();
    hearthGain.gain.value = fireplaceLit ? 1.0 : 0.0;
    hearthGain.connect(ambientGain);

    return ctx;
  }

  function startContinuousBed() {
    if (!ctx || !ambientGain || !hearthGain || continuousNodes.length > 0) return;

    const t = safeNow(ctx);

    // 1. Subtle clockwork silver-instrument mechanical whirr
    const whirrFilter = ctx.createBiquadFilter();
    whirrFilter.type = 'bandpass';
    whirrFilter.frequency.value = 340;
    whirrFilter.Q.value = 2.6;

    const whirrGain = ctx.createGain();
    whirrGain.gain.value = 0.045;
    whirrFilter.connect(whirrGain);
    whirrGain.connect(ambientGain);

    const oscA = ctx.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.value = 108;

    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 162.4;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.42;

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 65;

    lfo.connect(lfoDepth);
    lfoDepth.connect(whirrFilter.frequency);
    oscA.connect(whirrFilter);
    oscB.connect(whirrFilter);

    oscA.start(t);
    oscB.start(t);
    lfo.start(t);

    // 2. Warm low hearth rumble bed (gated by hearthGain)
    const hearthSource = ctx.createBufferSource();
    hearthSource.buffer = noiseBuffer;
    hearthSource.loop = true;

    const hearthLowpass = ctx.createBiquadFilter();
    hearthLowpass.type = 'lowpass';
    hearthLowpass.frequency.value = 145;

    const hearthBedGain = ctx.createGain();
    hearthBedGain.gain.value = 0.16;

    hearthSource.connect(hearthLowpass);
    hearthLowpass.connect(hearthBedGain);
    hearthBedGain.connect(hearthGain);
    hearthSource.start(t);

    continuousNodes.push(
      {
        stop: () => {
          oscA.stop();
          oscB.stop();
          lfo.stop();
          whirrGain.disconnect();
        },
      },
      {
        stop: () => {
          hearthSource.stop();
          hearthBedGain.disconnect();
        },
      }
    );
  }

  function scheduleClockworkTick() {
    if (!enabled || disposed || !ctx || !ambientGain) return;

    const t = safeNow(ctx);
    const tickNoise = ctx.createBufferSource();
    tickNoise.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300 + Math.random() * 1400;
    bp.Q.value = 5.5;

    const g = ctx.createGain();
    const peak = 0.032 + Math.random() * 0.028;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

    tickNoise.connect(bp);
    bp.connect(g);
    g.connect(ambientGain);
    tickNoise.start(t, Math.random() * 1.4, 0.04);

    // Occasional delicate gear escapement ping
    if (Math.random() < 0.42) {
      const ping = ctx.createOscillator();
      ping.type = 'sine';
      ping.frequency.value = 1650 + Math.random() * 900;

      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.linearRampToValueAtTime(0.012, t + 0.004);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      ping.connect(pg);
      pg.connect(ambientGain);
      ping.start(t);
      ping.stop(t + 0.05);
    }

    const nextMs = Math.random() < 0.25 ? 260 + Math.random() * 140 : 480 + Math.random() * 340;
    registerTimer(scheduleClockworkTick, nextMs);
  }

  function schedulePuffWhisper() {
    if (!enabled || disposed || !ctx || !ambientGain) return;

    const t = safeNow(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(980 + Math.random() * 320, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.42);
    bp.Q.value = 2.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);

    src.connect(bp);
    bp.connect(g);
    g.connect(ambientGain);
    src.start(t, Math.random() * 1.2, 0.52);

    registerTimer(schedulePuffWhisper, 2600 + Math.random() * 3400);
  }

  function scheduleHearthCrackle() {
    if (!enabled || disposed || !ctx || !hearthGain) return;

    if (fireplaceLit) {
      const t = safeNow(ctx);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700 + Math.random() * 2600;
      bp.Q.value = 3.5;

      const g = ctx.createGain();
      const peak = 0.045 + Math.random() * 0.055;
      const dur = 0.015 + Math.random() * 0.025;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(bp);
      bp.connect(g);
      g.connect(hearthGain);
      src.start(t, Math.random() * 1.5, dur + 0.02);
    }

    registerTimer(scheduleHearthCrackle, 190 + Math.random() * 720);
  }

  function scheduleSnoozeBreath() {
    if (!enabled || disposed || !ctx || !ambientGain) return;

    const t = safeNow(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(310, t);
    bp.frequency.linearRampToValueAtTime(380, t + 0.9);
    bp.frequency.linearRampToValueAtTime(280, t + 2.3);
    bp.Q.value = 3.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.052, t + 0.85);
    g.gain.linearRampToValueAtTime(0.018, t + 1.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);

    src.connect(bp);
    bp.connect(g);
    g.connect(ambientGain);
    src.start(t, Math.random() * 1.0, 2.45);
    src.stop(t + 2.46);

    registerTimer(scheduleSnoozeBreath, 4400 + Math.random() * 3800);
  }

  function startSchedulers() {
    clearAllTimers();
    startContinuousBed();
    registerTimer(scheduleClockworkTick, 180);
    registerTimer(schedulePuffWhisper, 950);
    registerTimer(scheduleHearthCrackle, 240);
    registerTimer(scheduleSnoozeBreath, 1600);
  }

  function setEnabled(nextState) {
    if (disposed) return false;
    const target = Boolean(nextState);
    if (target === enabled) return enabled;

    enabled = target;
    if (enabled) {
      const audioCtx = ensureContext();
      if (!audioCtx) {
        enabled = false;
        return false;
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const t = safeNow(audioCtx);
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), t);
      masterGain.gain.linearRampToValueAtTime(0.82, t + 0.28);
      startSchedulers();
    } else {
      clearAllTimers();
      if (ctx && masterGain) {
        const t = safeNow(ctx);
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), t);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        setTimeout(() => {
          if (!enabled) {
            stopContinuousBed();
            if (ctx && ctx.state === 'running') {
              ctx.suspend?.().catch(() => {});
            }
          }
        }, 210);
      }
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled && !disposed;
  }

  function setFireplaceLit(lit) {
    fireplaceLit = Boolean(lit);
    if (ctx && hearthGain) {
      const t = safeNow(ctx);
      hearthGain.gain.cancelScheduledValues(t);
      hearthGain.gain.setValueAtTime(hearthGain.gain.value, t);
      hearthGain.gain.linearRampToValueAtTime(fireplaceLit ? 1.0 : 0.0, t + 0.55);
    }
    return fireplaceLit;
  }

  function readyForSfx() {
    if (!enabled || disposed || !ctx || !sfxGain) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  }

  function playStoneGrind() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    // Granite grinding noise layer
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.linearRampToValueAtTime(340, t + 0.45);
    lp.frequency.exponentialRampToValueAtTime(140, t + 1.35);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 1.3);
    bp.Q.value = 1.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.09);
    g.gain.setValueAtTime(0.42, t + 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.38);

    src.connect(lp);
    src.connect(bp);
    lp.connect(g);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(t, 0, 1.4);
    src.stop(t + 1.42);

    // Stone hop thud
    const thud = ctx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(72, t);
    thud.frequency.exponentialRampToValueAtTime(34, t + 0.24);

    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.linearRampToValueAtTime(0.36, t + 0.015);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    thud.connect(tg);
    tg.connect(sfxGain);
    thud.start(t);
    thud.stop(t + 0.3);
    return true;
  }

  function playOakDoorCreak() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    // Two solid brass-on-oak knocker knocks
    [0, 0.22].forEach((offset) => {
      const kt = t + offset;
      const wood = ctx.createOscillator();
      wood.type = 'triangle';
      wood.frequency.setValueAtTime(155, kt);
      wood.frequency.exponentialRampToValueAtTime(78, kt + 0.11);

      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.0001, kt);
      wg.gain.linearRampToValueAtTime(0.4, kt + 0.006);
      wg.gain.exponentialRampToValueAtTime(0.0001, kt + 0.14);

      wood.connect(wg);
      wg.connect(sfxGain);
      wood.start(kt);
      wood.stop(kt + 0.16);

      // Brass ring overtone
      const brass = ctx.createOscillator();
      brass.type = 'sine';
      brass.frequency.setValueAtTime(980, kt);

      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, kt);
      bg.gain.linearRampToValueAtTime(0.11, kt + 0.004);
      bg.gain.exponentialRampToValueAtTime(0.0001, kt + 0.18);

      brass.connect(bg);
      bg.connect(sfxGain);
      brass.start(kt);
      brass.stop(kt + 0.2);
    });

    // Heavy oak door creak at t + 0.42s
    const ct = t + 0.42;
    const creakOsc = ctx.createOscillator();
    creakOsc.type = 'sawtooth';
    creakOsc.frequency.setValueAtTime(132, ct);
    creakOsc.frequency.linearRampToValueAtTime(178, ct + 0.35);
    creakOsc.frequency.linearRampToValueAtTime(118, ct + 0.85);

    const creakFilter = ctx.createBiquadFilter();
    creakFilter.type = 'bandpass';
    creakFilter.frequency.setValueAtTime(340, ct);
    creakFilter.frequency.linearRampToValueAtTime(520, ct + 0.4);
    creakFilter.frequency.linearRampToValueAtTime(260, ct + 0.88);
    creakFilter.Q.value = 5.2;

    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, ct);
    cg.gain.linearRampToValueAtTime(0.16, ct + 0.12);
    cg.gain.linearRampToValueAtTime(0.11, ct + 0.55);
    cg.gain.exponentialRampToValueAtTime(0.0001, ct + 0.92);

    creakOsc.connect(creakFilter);
    creakFilter.connect(cg);
    cg.connect(sfxGain);
    creakOsc.start(ct);
    creakOsc.stop(ct + 0.94);
    return true;
  }

  function playPensieveShimmer() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    // Ethereal silvery harmonic chord (D-A-D-G#-D-A)
    const freqs = [293.66, 440.0, 587.33, 830.61, 1174.66, 1760.0];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((idx - 2.5) * 4, t);

      const g = ctx.createGain();
      const start = t + idx * 0.045;
      const peak = 0.095 / (1 + idx * 0.24);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(peak, start + 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.85);

      osc.connect(g);
      g.connect(sfxGain);
      osc.start(start);
      osc.stop(start + 1.9);
    });

    // Silvery liquid-light high wash
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2600, t);
    hp.Q.value = 3.0;

    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.0001, t);
    ag.gain.linearRampToValueAtTime(0.06, t + 0.25);
    ag.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);

    air.connect(hp);
    hp.connect(ag);
    ag.connect(sfxGain);
    air.start(t, 0.2, 1.55);
    return true;
  }

  function playPhoenixChime() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    // Warm rising golden harmonic swell
    const notes = [261.63, 392.0, 587.33, 659.25, 987.77];
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.11;
      const osc = ctx.createOscillator();
      osc.type = idx < 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.992, start);
      osc.frequency.exponentialRampToValueAtTime(freq, start + 0.18);

      const g = ctx.createGain();
      const peak = 0.13 / (1 + idx * 0.18);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(peak, start + 0.24);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);

      osc.connect(g);
      g.connect(sfxGain);
      osc.start(start);
      osc.stop(start + 2.15);
    });
    return true;
  }

  function playSerpentHiss() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    // Subtle wand tap ping on silver instrument
    const tap = ctx.createOscillator();
    tap.type = 'sine';
    tap.frequency.setValueAtTime(1480, t);
    const tapGain = ctx.createGain();
    tapGain.gain.setValueAtTime(0.0001, t);
    tapGain.gain.linearRampToValueAtTime(0.14, t + 0.004);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    tap.connect(tapGain);
    tapGain.connect(sfxGain);
    tap.start(t);
    tap.stop(t + 0.24);

    // Dual-band ethereal whisper ("In essence divided?")
    [2250, 4450].forEach((centerFreq, idx) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(centerFreq, t + 0.08);
      bp.frequency.exponentialRampToValueAtTime(centerFreq * (idx === 0 ? 0.78 : 1.15), t + 1.05);
      bp.Q.value = 4.4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.08);
      g.gain.linearRampToValueAtTime(0.15, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

      src.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      src.start(t + 0.08, idx * 0.4, 1.08);
    });
    return true;
  }

  function playHatRustle() {
    if (!readyForSfx()) return false;
    const t = safeNow(ctx);

    [0, 0.16].forEach((offset, idx) => {
      const ht = t + offset;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(idx === 0 ? 580 : 1280, ht);
      bp.frequency.exponentialRampToValueAtTime(idx === 0 ? 920 : 640, ht + 0.2);
      bp.Q.value = 1.9;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ht);
      g.gain.linearRampToValueAtTime(0.22, ht + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, ht + 0.24);

      src.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      src.start(ht, idx * 0.5, 0.28);
    });
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    clearAllTimers();
    stopContinuousBed();

    if (ctx) {
      ctx.close?.().catch(() => {});
      ctx = null;
    }
    masterGain = null;
    ambientGain = null;
    sfxGain = null;
    hearthGain = null;
    noiseBuffer = null;
  }

  return {
    toggle,
    setEnabled,
    isEnabled,
    setFireplaceLit,
    playStoneGrind,
    playOakDoorCreak,
    playPensieveShimmer,
    playPhoenixChime,
    playSerpentHiss,
    playHatRustle,
    dispose,
  };
}
