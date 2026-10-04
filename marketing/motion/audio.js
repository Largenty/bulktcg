/* La bande-son du film, synthétisée de bout en bout : aucune musique ni aucun
   bruitage sous licence, rien à télécharger.

   Elle est rendue une fois, hors temps réel (OfflineAudioContext), en un seul
   tampon. Le lecteur joue ce tampon ; render.mjs l'exporte en WAV et le pose
   sous la vidéo. Les deux entendent donc exactement la même chose, calée à
   l'image près : les bruitages sont posés par la ligne de temps du film
   (tl.sfx), à l'instant de l'image qui les déclenche.

   120 battements par minute : un temps vaut 0,5 s, une mesure 2 s. Les
   changements de plan tombent sur les temps. */

(function () {
  "use strict";

  const BEAT = 0.5;
  const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /* La mineur et son relatif do majeur. Les nappes sont voisées dans le
     médium, sans tierce doublée ; la basse joue la fondamentale. */
  const CHORDS = {
    Am: { root: 33, pad: [57, 60, 64, 71] },
    F: { root: 29, pad: [53, 57, 60, 64] },
    C: { root: 36, pad: [55, 60, 64, 74] },
    G: { root: 31, pad: [55, 59, 62, 69] },
  };

  /* Le plan : intro sombre, montée, la marque, le groove, une respiration
     sur l'offre pro, le comparatif, la fin. */
  const SECTIONS = {
    introEnd: 10.5,
    drop: 12.0,
    breakStart: 35.0,
    breakEnd: 38.0,
    outro: 46.0,
  };

  function seeded(seed) {
    let state = seed >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1000000) / 1000000;
    };
  }

  function createNoise(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const random = seeded(7);
    for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
    return buffer;
  }

  /* Une salle : du bruit qui décroît, adouci au passage. */
  function createImpulse(ctx, seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      const random = seeded(11 + channel * 17);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth += (random() * 2 - 1 - smooth) * 0.42;
        data[i] = smooth * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function build(ctx) {
    const out = ctx.createGain();
    out.gain.value = 1;

    /* Colle puis plafond : un compresseur doux sur le mélange, un second
       presque limiteur derrière lui. Le tampon est normalisé après rendu. */
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.knee.value = 8;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.18;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.09;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    /* Sous 30 Hz, rien qu'un haut-parleur restitue : de la marge en moins.
       Un plateau d'aigus rend l'air que les petits haut-parleurs perdent. */
    const rumble = ctx.createBiquadFilter();
    rumble.type = "highpass";
    rumble.frequency.value = 30;
    rumble.Q.value = 0.7;
    const air = ctx.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 6500;
    air.gain.value = 3;
    master.connect(rumble).connect(air).connect(glue).connect(limiter).connect(out).connect(ctx.destination);

    const drums = ctx.createGain();
    drums.gain.value = 0.9;
    drums.connect(master);

    /* La musique passe sous la grosse caisse : le pompage du groove. */
    const duck = ctx.createGain();
    duck.gain.value = 1;
    const music = ctx.createGain();
    music.gain.value = 0.85;
    duck.connect(music).connect(master);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.7;
    sfx.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = createImpulse(ctx, 2.6, 3.4);
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.32;
    reverbSend.connect(reverb).connect(reverbReturn).connect(master);

    /* Écho au temps pointé (trois doubles croches). */
    const delay = ctx.createDelay(1);
    delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = "lowpass";
    delayTone.frequency.value = 2600;
    const delaySend = ctx.createGain();
    const delayReturn = ctx.createGain();
    delayReturn.gain.value = 0.28;
    delaySend.connect(delay);
    delay.connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(delayReturn).connect(master);

    return { out, master, drums, duck, music, sfx, reverbSend, delaySend, noise: createNoise(ctx, 3) };
  }

  /* ---------- instruments ---------- */

  function envelope(param, t, peak, attack, decay, floor = 0.0001) {
    param.setValueAtTime(floor, t);
    param.exponentialRampToValueAtTime(Math.max(peak, floor * 2), t + attack);
    param.exponentialRampToValueAtTime(floor, t + attack + decay);
  }

  function noiseSource(ctx, bus, t, duration, random) {
    const source = ctx.createBufferSource();
    source.buffer = bus.noise;
    const offset = random() * (bus.noise.duration - duration - 0.05);
    source.start(t, Math.max(0, offset), duration + 0.02);
    return source;
  }

  function makeInstruments(ctx, bus) {
    const random = seeded(23);

    const send = (node, target, amount) => {
      if (amount <= 0) return;
      const gain = ctx.createGain();
      gain.gain.value = amount;
      node.connect(gain).connect(target);
    };

    const filtered = (t, duration, { type, frequency, q = 0.8, peak, attack = 0.001, decay, to, reverb = 0, pan = 0 }) => {
      const source = noiseSource(ctx, bus, t, duration, random);
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = ctx.createGain();
      envelope(gain.gain, t, peak, attack, decay);
      let node = source.connect(filter).connect(gain);
      if (pan) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        node = node.connect(panner);
      }
      node.connect(to);
      send(node, bus.reverbSend, reverb);
      return { source, filter, gain };
    };

    const kick = (t, velocity = 1) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.1);
      const gain = ctx.createGain();
      envelope(gain.gain, t, 0.72 * velocity, 0.003, 0.32);
      osc.connect(gain).connect(bus.drums);
      osc.start(t);
      osc.stop(t + 0.5);
      filtered(t, 0.02, { type: "highpass", frequency: 1600, peak: 0.22 * velocity, decay: 0.012, to: bus.drums });
    };

    const clap = (t, velocity = 1) => {
      for (const offset of [0, 0.011, 0.023]) {
        filtered(t + offset, 0.03, { type: "bandpass", frequency: 1350, q: 1.1, peak: 0.56 * velocity, decay: 0.013, to: bus.drums });
      }
      filtered(t + 0.026, 0.3, { type: "bandpass", frequency: 1250, q: 0.9, peak: 0.4 * velocity, decay: 0.2, to: bus.drums, reverb: 0.35 });
    };

    const hat = (t, velocity = 1, open = false) =>
      filtered(t, open ? 0.32 : 0.06, {
        type: "highpass",
        frequency: open ? 6400 : 7000,
        q: 0.6,
        peak: (open ? 0.2 : 0.3) * velocity,
        decay: open ? 0.24 : 0.038,
        to: bus.drums,
        pan: 0.18,
      });

    const snare = (t, velocity = 1) => {
      filtered(t, 0.16, { type: "bandpass", frequency: 1900, q: 0.7, peak: 0.42 * velocity, decay: 0.12, to: bus.drums, reverb: 0.2 });
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(205, t);
      body.frequency.exponentialRampToValueAtTime(170, t + 0.08);
      const gain = ctx.createGain();
      envelope(gain.gain, t, 0.18 * velocity, 0.002, 0.09);
      body.connect(gain).connect(bus.drums);
      body.start(t);
      body.stop(t + 0.15);
    };

    const bass = (t, midi, duration, velocity = 1) => {
      const frequency = mtof(midi);
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = frequency;
      const grit = ctx.createOscillator();
      grit.type = "sawtooth";
      grit.frequency.value = frequency;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.setValueAtTime(1500, t);
      tone.frequency.exponentialRampToValueAtTime(420, t + 0.12);
      tone.Q.value = 2;
      const gritGain = ctx.createGain();
      gritGain.gain.value = 0.62;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25 * velocity, t + 0.006);
      gain.gain.setValueAtTime(0.25 * velocity, t + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      sub.connect(gain);
      grit.connect(tone).connect(gritGain).connect(gain);
      gain.connect(bus.duck);
      sub.start(t);
      grit.start(t);
      sub.stop(t + duration + 0.02);
      grit.stop(t + duration + 0.02);
    };

    const pad = (t, notes, duration, { cutoff = 1600, level = 0.1, attack = 0.45, release = 0.9, reverb = 0.45 } = {}) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level, t + attack);
      gain.gain.setValueAtTime(level, t + duration);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration + release);
      filter.connect(gain).connect(bus.duck);
      send(gain, bus.reverbSend, reverb);
      for (const midi of notes) {
        for (const detune of [-8, 7]) {
          const osc = ctx.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.value = mtof(midi);
          osc.detune.value = detune;
          const voice = ctx.createGain();
          voice.gain.value = 0.22;
          osc.connect(voice).connect(filter);
          osc.start(t);
          osc.stop(t + duration + release + 0.05);
        }
      }
    };

    const pluck = (t, midi, velocity = 1) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = mtof(midi);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 3;
      filter.frequency.setValueAtTime(4200, t);
      filter.frequency.exponentialRampToValueAtTime(520, t + 0.14);
      const gain = ctx.createGain();
      envelope(gain.gain, t, 0.13 * velocity, 0.002, 0.24);
      osc.connect(filter).connect(gain).connect(bus.duck);
      send(gain, bus.delaySend, 0.5);
      send(gain, bus.reverbSend, 0.18);
      osc.start(t);
      osc.stop(t + 0.3);
    };

    /* La signature sonore : une cloche, deux partiels inharmoniques. */
    const bell = (t, midi, velocity = 1, to = bus.music) => {
      const base = mtof(midi);
      [
        [1, 0.5, 1.6],
        [2.01, 0.16, 0.9],
        [3.98, 0.06, 0.5],
      ].forEach(([ratio, level, decay]) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = base * ratio;
        const gain = ctx.createGain();
        envelope(gain.gain, t, level * velocity * 0.32, 0.003, decay);
        osc.connect(gain).connect(to);
        send(gain, bus.reverbSend, 0.5);
        osc.start(t);
        osc.stop(t + decay + 0.1);
      });
    };

    const riser = (t0, t1, level = 1) => {
      const duration = t1 - t0;
      const source = noiseSource(ctx, bus, t0, duration, random);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.6;
      filter.frequency.setValueAtTime(380, t0);
      filter.frequency.exponentialRampToValueAtTime(7200, t1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.6 * level, t1 - 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, t1);
      source.connect(filter).connect(gain).connect(bus.sfx);
      send(gain, bus.reverbSend, 0.25);
      const tone = ctx.createOscillator();
      tone.type = "sawtooth";
      tone.frequency.setValueAtTime(mtof(57), t0);
      tone.frequency.exponentialRampToValueAtTime(mtof(69), t1);
      const toneFilter = ctx.createBiquadFilter();
      toneFilter.type = "lowpass";
      toneFilter.frequency.setValueAtTime(500, t0);
      toneFilter.frequency.exponentialRampToValueAtTime(3000, t1);
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, t0);
      toneGain.gain.exponentialRampToValueAtTime(0.09 * level, t1 - 0.02);
      toneGain.gain.linearRampToValueAtTime(0.0001, t1);
      tone.connect(toneFilter).connect(toneGain).connect(bus.sfx);
      tone.start(t0);
      tone.stop(t1 + 0.02);
    };

    const impact = (t, level = 1) => {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(72, t);
      sub.frequency.exponentialRampToValueAtTime(31, t + 0.9);
      const gain = ctx.createGain();
      envelope(gain.gain, t, 0.9 * level, 0.004, 1.5);
      sub.connect(gain).connect(bus.sfx);
      sub.start(t);
      sub.stop(t + 1.6);
      filtered(t, 0.9, { type: "lowpass", frequency: 1100, q: 0.5, peak: 0.5 * level, decay: 0.75, to: bus.sfx, reverb: 0.6 });
      filtered(t, 1.6, { type: "highpass", frequency: 5200, q: 0.5, peak: 0.07 * level, attack: 0.005, decay: 1.4, to: bus.sfx, reverb: 0.4 });
    };

    /* ---------- bruitages, appelés par les repères du film ---------- */

    const effects = {
      whoosh(t, { duration = 0.5, level = 1, from = -0.7, to = 0.7 } = {}) {
        const source = noiseSource(ctx, bus, t, duration, random);
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 1.1;
        filter.frequency.setValueAtTime(450, t);
        filter.frequency.exponentialRampToValueAtTime(3400, t + duration * 0.55);
        filter.frequency.exponentialRampToValueAtTime(700, t + duration);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.34 * level, t + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(from, t);
        panner.pan.linearRampToValueAtTime(to, t + duration);
        source.connect(filter).connect(gain).connect(panner).connect(bus.sfx);
        send(gain, bus.reverbSend, 0.2);
      },
      pop(t, { pitch = 1, level = 1 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(480 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(860 * pitch, t + 0.045);
        const gain = ctx.createGain();
        envelope(gain.gain, t, 0.2 * level, 0.003, 0.085);
        osc.connect(gain).connect(bus.sfx);
        osc.start(t);
        osc.stop(t + 0.12);
      },
      click(t, { level = 1 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(2300, t);
        const tone = ctx.createBiquadFilter();
        tone.type = "bandpass";
        tone.frequency.value = 2600;
        const gain = ctx.createGain();
        envelope(gain.gain, t, 0.07 * level, 0.001, 0.016);
        osc.connect(tone).connect(gain).connect(bus.sfx);
        osc.start(t);
        osc.stop(t + 0.03);
        filtered(t, 0.02, { type: "highpass", frequency: 4200, peak: 0.12 * level, decay: 0.01, to: bus.sfx });
      },
      tick(t, { pitch = 1, level = 1 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 1500 * pitch;
        const gain = ctx.createGain();
        envelope(gain.gain, t, 0.09 * level, 0.001, 0.028);
        osc.connect(gain).connect(bus.sfx);
        osc.start(t);
        osc.stop(t + 0.05);
      },
      type(t, { level = 1 } = {}) {
        filtered(t, 0.03, { type: "bandpass", frequency: 3200 + random() * 1600, q: 1.4, peak: 0.13 * level * (0.7 + random() * 0.3), decay: 0.014, to: bus.sfx });
      },
      stamp(t, { level = 1 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
        const gain = ctx.createGain();
        envelope(gain.gain, t, 0.75 * level, 0.002, 0.32);
        osc.connect(gain).connect(bus.sfx);
        osc.start(t);
        osc.stop(t + 0.4);
        filtered(t, 0.14, { type: "lowpass", frequency: 1500, peak: 0.42 * level, decay: 0.1, to: bus.sfx, reverb: 0.2 });
        filtered(t, 0.05, { type: "highpass", frequency: 3200, peak: 0.2 * level, decay: 0.028, to: bus.sfx });
      },
      thud(t, { level = 1 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(82, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.2);
        const gain = ctx.createGain();
        envelope(gain.gain, t, 0.85 * level, 0.002, 0.36);
        osc.connect(gain).connect(bus.sfx);
        osc.start(t);
        osc.stop(t + 0.42);
        filtered(t, 0.22, { type: "lowpass", frequency: 480, q: 0.7, peak: 0.5 * level, decay: 0.18, to: bus.sfx, reverb: 0.15 });
      },
      swish(t, { level = 1 } = {}) {
        const { filter } = filtered(t, 0.14, { type: "bandpass", frequency: 2200, q: 1.3, peak: 0.16 * level, attack: 0.02, decay: 0.09, to: bus.sfx, pan: (random() - 0.5) * 0.8 });
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(6500, t + 0.11);
      },
      chime(t, { level = 1 } = {}) {
        bell(t, 88, level, bus.sfx);
        bell(t + 0.1, 95, level * 0.9, bus.sfx);
      },
      motif(t, { level = 1 } = {}) {
        [72, 76, 79, 84].forEach((midi, index) => bell(t + index * BEAT * 0.5, midi, level * (index === 3 ? 1.1 : 0.85)));
      },
      impact(t, { level = 1 } = {}) {
        impact(t, level);
      },
      riser(t, { duration = 1.4, level = 1 } = {}) {
        riser(t, t + duration, level);
      },
    };

    return { kick, clap, hat, snare, bass, pad, pluck, bell, riser, impact, effects };
  }

  /* ---------- la partition ---------- */

  function scoreMusic(ctx, bus, play, duration) {
    const { kick, clap, hat, snare, bass, pad, pluck } = play;
    const kicks = [];
    const addKick = (t, velocity) => {
      kick(t, velocity);
      kicks.push(t);
    };

    /* Intro : la mineur, filtrée, un cœur qui bat. Sol en fin d'intro, pour
       que la marque arrive sur do comme une cadence. */
    const intro = [
      ["Am", 0, 4],
      ["F", 4, 2],
      ["Am", 6, 2],
      ["G", 8, 2.5],
    ];
    intro.forEach(([name, start, length], index) => {
      pad(start, CHORDS[name].pad, length, { cutoff: 620 + index * 120, level: 0.085, attack: index === 0 ? 1.4 : 0.35, release: 0.8 });
      for (let t = start; t < start + length - 0.01; t += BEAT * 2) bass(t, CHORDS[name].root + 12, 0.32, 0.55);
    });
    for (let t = 0; t < SECTIONS.introEnd - 0.01; t += 1) addKick(t, 0.42);
    /* Des croches à partir de 2 s, des doubles croches à partir de 6 s : la
       tension monte avec le problème. */
    for (let t = 2; t < SECTIONS.introEnd - 0.01; t += BEAT / 4) {
      const sixteenth = Math.round(t / (BEAT / 4));
      const onEighth = sixteenth % 2 === 0;
      if (t < 6 && !onEighth) continue;
      hat(t, onEighth ? 0.42 : 0.22);
    }

    /* Montée : roulement qui se resserre, puis un silence d'une double
       croche avant la marque. */
    const rollEnd = SECTIONS.drop - 0.08;
    let step = BEAT / 2;
    for (let t = SECTIONS.introEnd; t < rollEnd - 0.005; t += step) {
      const progress = (t - SECTIONS.introEnd) / (rollEnd - SECTIONS.introEnd);
      snare(t, 0.15 + progress * 0.55);
      if (t >= 11.0) step = BEAT / 4;
      if (t >= 11.5) step = BEAT / 8;
    }
    pad(SECTIONS.introEnd, CHORDS.G.pad, rollEnd - SECTIONS.introEnd, { cutoff: 900, level: 0.08, attack: 1.2, release: 0.05 });
    /* La grosse caisse ne s'arrête pas avec l'intro : elle se resserre vers
       la marque, sans quoi l'énergie retombait juste avant le moment fort. */
    [10.5, 11.0, 11.5, 11.75].forEach((t, index) => addKick(t, 0.45 + index * 0.12));

    /* Le groove : do, sol, la mineur, fa — une mesure chacun. */
    const progression = ["C", "G", "Am", "F"];
    const groove = (from, to, { plucks }) => {
      for (let bar = 0; from + bar * 2 < to - 0.01; bar++) {
        const start = from + bar * 2;
        const chord = CHORDS[progression[bar % 4]];
        const length = Math.min(2, to - start);
        pad(start, chord.pad, length, { cutoff: 2600, level: 0.095, attack: 0.08, release: 0.5, reverb: 0.4 });
        for (let t = start; t < start + length - 0.01; t += BEAT / 2) {
          const offbeat = Math.abs(((t - start) / (BEAT / 2)) % 2 - 1) < 0.01;
          bass(t, chord.root + (offbeat ? 12 : 0), BEAT / 2 - 0.03, offbeat ? 0.8 : 1);
        }
        if (plucks(start)) {
          const tones = chord.pad.map((midi) => midi + 12);
          const order = [0, 1, 2, 3, 2, 1, 3, 2];
          for (let i = 0; i < 16 && start + i * (BEAT / 4) < start + length - 0.01; i++) {
            pluck(start + i * (BEAT / 4), tones[order[i % order.length]], i % 4 === 0 ? 1 : 0.7);
          }
        }
      }
      for (let t = from; t < to - 0.01; t += BEAT) {
        addKick(t, 1);
        if (Math.abs(((t - from) / BEAT) % 2 - 1) < 0.01) clap(t, 1);
      }
      for (let t = from; t < to - 0.01; t += BEAT / 4) {
        const index = Math.round((t - from) / (BEAT / 4));
        hat(t, [0.9, 0.35, 0.65, 0.35][index % 4]);
        if (t >= 16 && index % 4 === 2) hat(t, 0.8, true);
      }
    };

    groove(SECTIONS.drop, SECTIONS.breakStart, { plucks: (start) => start >= 16 });

    /* Respiration sur l'offre pro : plus de grosse caisse, la nappe se
       referme, puis un roulement relance le groove. */
    pad(SECTIONS.breakStart, CHORDS.Am.pad, 2, { cutoff: 900, level: 0.085, attack: 0.3, release: 0.4 });
    pad(SECTIONS.breakStart + 2, CHORDS.G.pad, 1, { cutoff: 1300, level: 0.085, attack: 0.2, release: 0.1 });
    for (let t = SECTIONS.breakStart; t < SECTIONS.breakEnd - 0.01; t += BEAT / 2) hat(t, 0.4);
    for (let t = SECTIONS.breakStart; t < SECTIONS.breakEnd - 1.01; t += BEAT * 2) bass(t, CHORDS.Am.root + 12, 0.4, 0.5);
    for (let t = SECTIONS.breakEnd - 1; t < SECTIONS.breakEnd - 0.06; t += BEAT / 4) {
      snare(t, 0.15 + ((t - (SECTIONS.breakEnd - 1)) / 1) * 0.45);
    }

    groove(SECTIONS.breakEnd, SECTIONS.outro, { plucks: () => true });

    /* Fin : do, longuement, et une dernière grosse caisse. */
    addKick(SECTIONS.outro, 1);
    pad(SECTIONS.outro, CHORDS.C.pad, 2.6, { cutoff: 2400, level: 0.09, attack: 0.02, release: 1.6, reverb: 0.6 });
    bass(SECTIONS.outro, CHORDS.C.root, 1.6, 1);

    /* Le pompage : la musique s'efface à chaque grosse caisse. */
    kicks.sort((a, b) => a - b);
    bus.duck.gain.setValueAtTime(1, 0);
    for (const t of kicks) {
      bus.duck.gain.setValueAtTime(t < SECTIONS.introEnd ? 0.75 : 0.42, t);
      bus.duck.gain.linearRampToValueAtTime(1, t + 0.26);
    }

    /* Le fondu final. */
    bus.out.gain.setValueAtTime(1, duration - 1.6);
    bus.out.gain.linearRampToValueAtTime(0.0001, duration);
  }

  async function render({ duration, cues, sampleRate = 48000 }) {
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineContext) return null;
    const ctx = new OfflineContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const bus = build(ctx);
    const play = makeInstruments(ctx, bus);
    scoreMusic(ctx, bus, play, duration);
    for (const cue of cues) {
      const effect = play.effects[cue.name];
      if (!effect) throw new Error(`Bruitage inconnu : ${cue.name}`);
      if (cue.t >= 0 && cue.t < duration) effect(cue.t, cue);
    }
    const buffer = await ctx.startRendering();
    normalize(buffer, 0.89);
    return buffer;
  }

  /* Le pic à −1 dBFS : pas d'écrêtage à l'export, quel que soit le
     mélange. */
  function normalize(buffer, target) {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak === 0) return;
    const gain = target / peak;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] *= gain;
    }
  }

  function stats(buffer) {
    const sections = [];
    const window = buffer.sampleRate;
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let start = 0; start < left.length; start += window) {
      let sum = 0;
      let peak = 0;
      const end = Math.min(left.length, start + window);
      for (let i = start; i < end; i++) {
        const value = (left[i] + right[i]) / 2;
        sum += value * value;
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      }
      const rms = Math.sqrt(sum / (end - start));
      sections.push({ second: start / window, rmsDb: 20 * Math.log10(rms || 1e-9), peakDb: 20 * Math.log10(peak || 1e-9) });
    }
    return sections;
  }

  /* WAV 16 bits, stéréo entrelacée, en base64 : de quoi passer le tampon à
     Node par page.evaluate. */
  function toWavBase64(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + frames * channels * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, frames * channels * 2, true);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, data[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    const view8 = new Uint8Array(bytes);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < view8.length; i += chunk) binary += String.fromCharCode.apply(null, view8.subarray(i, i + chunk));
    return btoa(binary);
  }

  window.BulkAudio = { render, stats, toWavBase64, SECTIONS };
})();
