/* Le moteur du film : une ligne de temps à images clés, déterministe.

   Une image ne dépend que de t. Le lecteur l'appelle soixante fois par
   seconde, render.mjs l'appelle image par image avant chaque capture : les
   deux voient exactement la même chose. Aucune transition ni animation CSS
   dans la scène — tout mouvement passe par ici.

   Le modèle est celui d'un logiciel de montage : chaque propriété d'un
   élément porte une liste d'images clés ; entre deux clés, la valeur suit la
   courbe de la clé d'arrivée. Avant la première clé, la valeur de la
   première ; après la dernière, celle de la dernière. */

(function () {
  "use strict";

  /* ---------- courbes ---------- */

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    const solve = (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const error = sampleX(t) - x;
        if (Math.abs(error) < 1e-6) return t;
        const slope = slopeX(t);
        if (Math.abs(slope) < 1e-6) break;
        t -= error / slope;
      }
      let low = 0;
      let high = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        const value = sampleX(t);
        if (Math.abs(value - x) < 1e-6) break;
        if (value < x) low = t;
        else high = t;
        t = (low + high) / 2;
      }
      return t;
    };
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
  }

  const back = (overshoot) => (t) => 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);

  const EASE = {
    linear: (t) => t,
    /* Saut : la valeur précédente tient jusqu'à l'instant de la clé. */
    hold: (t) => (t >= 1 ? 1 : 0),
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: back(1.70158),
    outBackSoft: back(1.1),
    outBackHard: back(2.8),
    inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
    outElastic: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    /* Les trois courbes des tokens du site (--ease-out, --ease-in-out,
       --ease-back) : le film bouge comme le site. */
    brand: cubicBezier(0.16, 1, 0.3, 1),
    brandInOut: cubicBezier(0.65, 0, 0.35, 1),
    brandBack: cubicBezier(0.34, 1.56, 0.64, 1),
    /* Un départ sec et une arrivée lente : les mouvements de caméra. */
    whip: cubicBezier(0.8, 0, 0.1, 1),
  };

  /* ---------- hasard reproductible ---------- */

  function seeded(seed) {
    let state = seed >>> 0 || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 100000) / 100000;
    };
  }

  /* ---------- ligne de temps ---------- */

  const DEFAULTS = {
    x: 0, y: 0, z: 0, r: 0, rx: 0, ry: 0, s: 1, sx: 1, sy: 1, skx: 0,
    o: 1, blur: 0, gray: 0, bright: 1,
    ct: 0, cr: 0, cb: 0, cl: 0,
    dash: 0, type: 1, count: 0,
  };
  const TRANSFORM = ["x", "y", "z", "rx", "ry", "r", "skx", "s", "sx", "sy"];
  const FILTER = ["blur", "gray", "bright"];
  const CLIP = ["ct", "cr", "cb", "cl"];

  /* Un nombre qui finit dans une chaîne CSS : jamais de notation
     exponentielle (« 1e-7px » n'est pas du CSS). */
  const num = (value) => (Math.abs(value) < 1e-4 ? 0 : Math.round(value * 1000) / 1000);

  class Timeline {
    constructor(root) {
      this.root = root;
      this.targets = new Map();
      this.cues = [];
      this.hooks = [];
    }

    els(target) {
      if (target == null) return [];
      if (typeof target === "string") {
        const found = Array.from(this.root.querySelectorAll(target));
        if (!found.length) throw new Error(`Aucun élément pour « ${target} »`);
        return found;
      }
      if (target instanceof Element) return [target];
      return Array.from(target).flatMap((item) => this.els(item));
    }

    track(el, prop) {
      let info = this.targets.get(el);
      if (!info) {
        info = { tracks: new Map(), last: {} };
        this.targets.set(el, info);
      }
      let track = info.tracks.get(prop);
      if (!track) {
        track = { prop, keys: [], format: null };
        info.tracks.set(prop, track);
      }
      return track;
    }

    key(target, prop, t, value, ease = "linear") {
      const curve = typeof ease === "function" ? ease : EASE[ease];
      if (!curve) throw new Error(`Courbe inconnue : ${ease}`);
      for (const el of this.els(target)) {
        const keys = this.track(el, prop).keys;
        let index = keys.length;
        while (index > 0 && keys[index - 1].t > t) index--;
        keys.splice(index, 0, { t, v: value, ease: curve });
      }
      return this;
    }

    static valueOf(track, t) {
      const keys = track.keys;
      if (!keys.length) return DEFAULTS[track.prop] ?? 0;
      if (t < keys[0].t) return keys[0].v;
      let high = keys.length - 1;
      if (t >= keys[high].t) return keys[high].v;
      let low = 0;
      while (low < high - 1) {
        const middle = (low + high) >> 1;
        if (keys[middle].t <= t) low = middle;
        else high = middle;
      }
      const from = keys[low];
      const to = keys[low + 1];
      const span = to.t - from.t;
      if (span <= 0) return to.v;
      return from.v + (to.v - from.v) * to.ease((t - from.t) / span);
    }

    valueAt(el, prop, t) {
      const track = this.targets.get(el)?.tracks.get(prop);
      return track ? Timeline.valueOf(track, t) : (DEFAULTS[prop] ?? 0);
    }

    /* De « from » (ou de la valeur courante à t) vers « to », sur d. */
    fromTo(target, from, to, t, d, ease = "brand") {
      for (const el of this.els(target)) {
        for (const prop of Object.keys(to)) {
          const start = from[prop] !== undefined ? from[prop] : this.valueAt(el, prop, t);
          this.key(el, prop, t, start, "hold");
          this.key(el, prop, t + d, to[prop], ease);
        }
      }
      return this;
    }

    to(target, to, t, d, ease = "brand") {
      return this.fromTo(target, {}, to, t, d, ease);
    }

    /* Un changement d'état à l'instant t. Sur une piste encore vide, l'état
       d'avant est la valeur par défaut : sans cette clé de départ, la valeur
       posée à t vaudrait aussi pour tout ce qui précède — un « masquer à
       36 s » masquerait l'élément dès la première image. */
    set(target, props, t) {
      for (const el of this.els(target)) {
        for (const prop of Object.keys(props)) {
          if (!this.track(el, prop).keys.length) this.key(el, prop, -1e6, DEFAULTS[prop] ?? 0, "hold");
          this.key(el, prop, t, props[prop], "hold");
        }
      }
      return this;
    }

    /* Une suite d'éléments, chacun décalé de « step ». */
    stagger(target, t, step, apply) {
      this.els(target).forEach((el, index) => apply(el, t + index * step, index));
      return this;
    }

    /* Un compteur : le texte de l'élément suit la valeur, mise en forme. */
    counter(target, t, d, from, to, format, ease = "outCubic") {
      for (const el of this.els(target)) {
        this.track(el, "count").format = format;
        this.key(el, "count", t, from, "hold");
        this.key(el, "count", t + d, to, ease);
      }
      return this;
    }

    /* Machine à écrire : le texte complet vit dans data-full. */
    type(target, t, d, ease = "linear") {
      for (const el of this.els(target)) {
        this.key(el, "type", t, 0, "hold");
        this.key(el, "type", t + d, 1, ease);
      }
      return this;
    }

    /* Un effet sonore, posé sur l'image qui le déclenche. */
    sfx(name, t, options = {}) {
      this.cues.push({ name, t, ...options });
      return this;
    }

    /* Ce qui ne s'écrit pas en images clés (un curseur qui clignote, des
       particules) : une fonction de t, rien d'autre. */
    hook(fn) {
      this.hooks.push(fn);
      return this;
    }

    render(t) {
      for (const [el, info] of this.targets) {
        const tracks = info.tracks;
        const last = info.last;
        const v = (prop) => {
          const track = tracks.get(prop);
          return track ? Timeline.valueOf(track, t) : DEFAULTS[prop];
        };

        if (info.hasTransform === undefined) {
          info.hasTransform = TRANSFORM.some((prop) => tracks.has(prop));
          info.hasFilter = FILTER.some((prop) => tracks.has(prop));
          info.hasClip = CLIP.some((prop) => tracks.has(prop));
          info.vars = Array.from(tracks.keys()).filter((prop) => prop.startsWith("--"));
        }

        if (info.hasTransform) {
          const scale = v("s");
          let transform = `translate3d(${num(v("x"))}px, ${num(v("y"))}px, ${num(v("z"))}px)`;
          if (tracks.has("rx")) transform += ` rotateX(${num(v("rx"))}deg)`;
          if (tracks.has("ry")) transform += ` rotateY(${num(v("ry"))}deg)`;
          if (tracks.has("r")) transform += ` rotate(${num(v("r"))}deg)`;
          if (tracks.has("skx")) transform += ` skewX(${num(v("skx"))}deg)`;
          transform += ` scale(${num(scale * v("sx"))}, ${num(scale * v("sy"))})`;
          if (last.transform !== transform) {
            el.style.transform = transform;
            last.transform = transform;
          }
        }

        if (tracks.has("o")) {
          const opacity = Math.max(0, Math.min(1, v("o")));
          const rounded = String(num(opacity));
          if (last.opacity !== rounded) {
            el.style.opacity = rounded;
            el.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
            last.opacity = rounded;
          }
        }

        if (info.hasFilter) {
          const parts = [];
          const blur = v("blur");
          const gray = v("gray");
          const bright = v("bright");
          if (blur > 0.01) parts.push(`blur(${num(blur)}px)`);
          if (gray > 0.001) parts.push(`grayscale(${num(gray)})`);
          if (Math.abs(bright - 1) > 0.001) parts.push(`brightness(${num(bright)})`);
          const filter = parts.join(" ") || "none";
          if (last.filter !== filter) {
            el.style.filter = filter;
            last.filter = filter;
          }
        }

        if (info.hasClip) {
          const clip = `inset(${num(v("ct"))}% ${num(v("cr"))}% ${num(v("cb"))}% ${num(v("cl"))}%)`;
          if (last.clip !== clip) {
            el.style.clipPath = clip;
            last.clip = clip;
          }
        }

        if (tracks.has("dash")) {
          const dash = String(num(v("dash")));
          if (last.dash !== dash) {
            el.style.strokeDashoffset = dash;
            last.dash = dash;
          }
        }

        for (const prop of info.vars) {
          const value = String(num(v(prop)));
          if (last[prop] !== value) {
            el.style.setProperty(prop, value);
            last[prop] = value;
          }
        }

        if (tracks.has("count")) {
          const track = tracks.get("count");
          const text = track.format(v("count"));
          if (last.count !== text) {
            el.textContent = text;
            last.count = text;
          }
        }

        if (tracks.has("type")) {
          const full = el.dataset.full || "";
          const shown = full.slice(0, Math.round(v("type") * full.length));
          if (last.type !== shown) {
            el.textContent = shown;
            last.type = shown;
          }
        }
      }
      for (const hook of this.hooks) hook(t);
    }
  }

  /* ---------- texte ---------- */

  /* Enveloppe chaque mot dans un masque : le mot monte de derrière sa ligne
     de base, comme un titre qui se compose. Les espaces insécables du
     français ne sont pas des points de coupure : « vous ? » reste d'un bloc. */
  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          for (const part of child.textContent.split(/( +)/)) {
            if (!part) continue;
            if (/^ +$/.test(part)) {
              fragment.appendChild(document.createTextNode(" "));
              continue;
            }
            const mask = document.createElement("span");
            mask.className = "mask";
            const inner = document.createElement("span");
            inner.className = "mask-in";
            inner.textContent = part;
            mask.appendChild(inner);
            fragment.appendChild(mask);
            words.push(inner);
          }
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      }
    };
    walk(el);
    return words;
  }

  /* ---------- lecteur ---------- */

  class Player {
    constructor({ duration, render, onTick, getAudio }) {
      this.duration = duration;
      this.renderFrame = render;
      this.onTick = onTick || (() => {});
      this.getAudio = getAudio;
      this.time = 0;
      this.playing = false;
      this.soundOn = true;
      this.context = null;
      this.source = null;
      this.generation = 0;
      this.raf = 0;
      this.loop = this.loop.bind(this);
    }

    now() {
      if (this.playing && this.source && this.context) {
        return this.startOffset + (this.context.currentTime - this.startContextTime);
      }
      if (this.playing) return this.startOffset + (performance.now() - this.startClock) / 1000;
      return this.time;
    }

    async startAudio() {
      if (!this.soundOn || !this.getAudio) return;
      const generation = ++this.generation;
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
      }
      if (this.context.state === "suspended") await this.context.resume();
      const buffer = await this.getAudio();
      /* Une pause, un saut ou un second départ pendant la préparation du son :
         ce départ-là n'est plus le bon. */
      if (!buffer || !this.playing || generation !== this.generation || this.source) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      /* Le son prend la main sur l'horloge : l'image suit l'audio, jamais
         l'inverse — une image en retard se rattrape, un son décalé non. Le
         départ est différé de 30 ms, et l'horloge avancée d'autant : l'image
         ne recule pas au moment du relais. */
      const lead = 0.03;
      const offset = this.now() + lead;
      if (offset >= buffer.duration) return;
      this.startContextTime = this.context.currentTime + lead;
      this.startOffset = offset;
      source.start(this.startContextTime, offset);
      this.source = source;
    }

    stopAudio() {
      this.generation++;
      if (this.source) {
        try {
          this.source.stop();
        } catch {
          /* déjà arrêtée */
        }
        this.source.disconnect();
        this.source = null;
      }
    }

    play() {
      if (this.playing) return;
      if (this.time >= this.duration - 0.02) this.time = 0;
      this.playing = true;
      this.startOffset = this.time;
      this.startClock = performance.now();
      this.startAudio();
      this.raf = requestAnimationFrame(this.loop);
      this.onTick(this.time, this.playing);
    }

    pause() {
      if (!this.playing) return;
      this.time = Math.min(this.now(), this.duration);
      this.playing = false;
      this.stopAudio();
      cancelAnimationFrame(this.raf);
      this.renderFrame(this.time);
      this.onTick(this.time, this.playing);
    }

    toggle() {
      if (this.playing) this.pause();
      else this.play();
    }

    seek(t) {
      const wasPlaying = this.playing;
      if (wasPlaying) {
        this.playing = false;
        this.stopAudio();
        cancelAnimationFrame(this.raf);
      }
      this.time = Math.max(0, Math.min(this.duration, t));
      this.renderFrame(this.time);
      this.onTick(this.time, false);
      if (wasPlaying) this.play();
    }

    setSound(on) {
      this.soundOn = on;
      if (!on) this.stopAudio();
      else if (this.playing) this.startAudio();
    }

    loop() {
      if (!this.playing) return;
      const t = this.now();
      if (t >= this.duration) {
        this.time = this.duration;
        this.playing = false;
        this.stopAudio();
        this.renderFrame(this.duration);
        this.onTick(this.duration, false);
        return;
      }
      this.time = t;
      this.renderFrame(t);
      this.onTick(t, true);
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  window.Motion = { EASE, cubicBezier, seeded, Timeline, Player, splitWords };
})();
