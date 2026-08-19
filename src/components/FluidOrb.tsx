'use client';

import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { AudioLevels, CallStatus } from '@/lib/useVara';

/**
 * The assistant, rendered as a living particle orb.
 *
 * Structure is a perfect circle cut across its upper half by an undulating
 * wave, wrapped in a field of drifting particles:
 *
 *   lower boundary   long arc under the wave — the brightest structural edge
 *   fluid wave       morphing sine cutting the upper half, blown out at the
 *                    crests and where it strikes the rim
 *   upper boundary   faint cap closing the circle
 *   particle field   ~260 motes orbiting the sphere, pushed by sound
 *   sparks           short-lived embers thrown off on loud peaks
 *
 * The canvas is full-bleed and pointer-transparent — the wave has to be able
 * to leave the screen. The click target is a separate circular button laid
 * over the orb, sized from the same formula as R.
 *
 * Three palettes, cross-faded by who is talking:
 *
 *   idle    dusky crimson. Low and slow. Nobody is speaking yet.
 *   user    warm gold. Driven by the visitor's own microphone, measured with
 *           an AnalyserNode.
 *   agent   vivid VARA red → coral. Vara speaking.
 *
 * The wave's intersections with the circle are solved each frame by bisection,
 * which is what sells the sphere: as the wave rolls, the points where it meets
 * the rim slide around the circumference instead of staying pinned.
 *
 * Bloom is additive multi-pass strokes rather than shadowBlur — blurring ~140
 * segments per frame could never hold 60fps.
 */

type Props = {
  status: CallStatus;
  audio: MutableRefObject<AudioLevels>;
  active: boolean;
  theme: 'dark' | 'light';
};

/**
 * "Edge to edge" geometry.
 *
 * The wave runs ten radii past the rim on each side, which on any real screen
 * means it leaves the frame entirely — the line reads as continuing past the
 * display rather than stopping. Three numbers make that work:
 *
 *   taper    how fast the tail dims once it leaves the circle. At 0.16 it
 *            barely dims at all, which is what keeps it legible out to the
 *            edges. Raise it and the tails die just outside the orb.
 *   rHeight  circle radius against viewport height, capped against width so
 *            the orb never overflows a narrow phone.
 *   fadeX    horizontal stretch of the edge vignette. A circular fade would
 *            clip both tails; stretching it 6x lets the line reach the edge
 *            while the top and bottom still fall off softly.
 */
const ORB = {
  centerY: 0.44,   // sits above centre, leaving room for the status line
  // Mirrored in AssistantExperience as `min(30dvh, 38vw)` and `44dvh`.
  // Change these together, or the hit target drifts off the orb.
  rHeight: 0.25,
  rWidth: 0.34,
  extend: 10,
  taper: 0.16,
  rim: 1.1,
  amp: 0.8,
  fadeX: 6,
};

const SEGMENTS = 300;
const FIELD = 260;
const SPARKS = 170;
const BOOT_MS = 2200;

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

type Palette = {
  rimNear: RGB; // top of the rim gradient
  rimFar: RGB; // bottom of the rim gradient — the signature colour
  wave: [RGB, RGB, RGB, RGB];
  hot: RGB; // blow-out colour at crests
  cap: RGB; // faint upper arc
};

/**
 * Three palettes, all inside the VARA red family, separated by temperature
 * rather than by hue family: dusky crimson at rest, gold when the visitor
 * speaks, vivid brand red when Vara speaks. Every pair sits >100 RGB units
 * apart so the state is readable at a glance.
 */

/** Nobody speaking: dusky crimson, low and slow. */
const P_IDLE: Palette = {
  rimNear: [64, 16, 34],
  rimFar: [150, 40, 80],
  wave: [
    [150, 60, 110],
    [175, 70, 120],
    [190, 85, 110],
    [200, 110, 120],
  ],
  hot: [255, 214, 224],
  cap: [104, 36, 68],
};

/** The visitor is talking: warm gold. */
const P_USER: Palette = {
  rimNear: [138, 70, 8],
  rimFar: [255, 175, 45],
  wave: [
    [255, 190, 50],
    [255, 214, 90],
    [255, 232, 140],
    [255, 246, 200],
  ],
  hot: [255, 252, 232],
  cap: [166, 104, 24],
};

/** Vara is talking: the VARA brand red, driven hot. */
const P_AGENT: Palette = {
  rimNear: [140, 18, 24],
  rimFar: [255, 70, 55],
  wave: [
    [255, 40, 90],
    [255, 72, 62],
    [255, 112, 70],
    [255, 152, 92],
  ],
  hot: [255, 246, 232],
  cap: [186, 44, 52],
};

const blendPalettes = (wIdle: number, wUser: number, wAgent: number): Palette => {
  const at = (key: 'rimNear' | 'rimFar' | 'hot' | 'cap'): RGB => [
    P_IDLE[key][0] * wIdle + P_USER[key][0] * wUser + P_AGENT[key][0] * wAgent,
    P_IDLE[key][1] * wIdle + P_USER[key][1] * wUser + P_AGENT[key][1] * wAgent,
    P_IDLE[key][2] * wIdle + P_USER[key][2] * wUser + P_AGENT[key][2] * wAgent,
  ];
  const wave = [0, 1, 2, 3].map((i): RGB => [
    P_IDLE.wave[i][0] * wIdle + P_USER.wave[i][0] * wUser + P_AGENT.wave[i][0] * wAgent,
    P_IDLE.wave[i][1] * wIdle + P_USER.wave[i][1] * wUser + P_AGENT.wave[i][1] * wAgent,
    P_IDLE.wave[i][2] * wIdle + P_USER.wave[i][2] * wUser + P_AGENT.wave[i][2] * wAgent,
  ]) as [RGB, RGB, RGB, RGB];
  return {
    rimNear: at('rimNear'),
    rimFar: at('rimFar'),
    hot: at('hot'),
    cap: at('cap'),
    wave,
  };
};

function waveColour(pal: Palette, p: number, intensity: number): RGB {
  const scaled = clamp01(p) * 3;
  const i = Math.min(Math.floor(scaled), 2);
  const base = mix(pal.wave[i], pal.wave[i + 1], scaled - i);
  return mix(base, pal.hot, Math.pow(clamp01(intensity), 1.5));
}

type Mote = {
  angle: number;
  radius: number; // multiple of R
  speed: number;
  wobble: number;
  phase: number;
  size: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  decay: number;
  size: number;
  tint: number; // 0..1 position in the wave palette
};

export default function FluidOrb({ status, audio, active, theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const statusRef = useRef(status);
  const activeRef = useRef(active);
  const lightRef = useRef(theme === 'light');
  statusRef.current = status;
  activeRef.current = active;
  lightRef.current = theme === 'light';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Reduced motion calms the animation; it must not freeze it. A voice
    // assistant that sits perfectly still reads as broken, and on Windows the
    // "animation effects off" setting reports as reduce for everyone.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionScale = reduceMotion ? 0.4 : 1;

    /* ---- particle pools ------------------------------------------------ */
    const motes: Mote[] = Array.from({ length: FIELD }, () => ({
      angle: Math.random() * Math.PI * 2,
      // Capped well inside the canvas: motes that reach the bitmap edge get
      // clipped into a hard straight line, which reads as a glitch.
      radius: 0.70 + Math.random() * 0.42,
      speed: (0.04 + Math.random() * 0.12) * (Math.random() < 0.5 ? -1 : 1),
      wobble: 0.02 + Math.random() * 0.07,
      phase: Math.random() * Math.PI * 2,
      size: 0.5 + Math.random() * 1.5,
    }));

    const sparks: Spark[] = Array.from({ length: SPARKS }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0.02, size: 1, tint: 0.5,
    }));
    let sparkCursor = 0;
    const emit = (x: number, y: number, vx: number, vy: number, tint: number) => {
      const s = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARKS;
      s.x = x; s.y = y; s.vx = vx; s.vy = vy;
      s.life = 1;
      s.decay = 0.012 + Math.random() * 0.022;
      s.size = 0.7 + Math.random() * 1.7;
      s.tint = tint;
    };

    /* ---- sizing -------------------------------------------------------- */
    let width = 0;
    let height = 0;
    let repaint = () => {};

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Assigning canvas.width wipes the bitmap, so put it straight back.
      repaint();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    /* ---- eased state --------------------------------------------------- */
    let wIdle = 1;
    let wUser = 0;
    let wAgent = 0;
    let energy = 0;
    let smoothAgent = 0;
    let smoothUser = 0;
    let peakHold = 0;
    let primed = false;
    let bootStart = 0;
    let lastTime = 0;
    let raf = 0;

    const draw = (now: number) => {
      if (!bootStart) bootStart = now;
      const dt = lastTime ? Math.min(64, now - lastTime) : 16;
      lastTime = now;

      const st = statusRef.current;
      const isActive = activeRef.current;
      const connecting = st === 'connecting' || st === 'requesting-mic';
      const speaking = st === 'speaking';

      const t = now * 0.001 * motionScale;

      // Gradual assembly on first load: the orb builds itself rather than
      // popping in. Also covers "it should already be alive before I speak".
      const boot = smoothstep(0, 1, clamp01((now - bootStart) / BOOT_MS));

      /* ---- who is talking --------------------------------------------- */
      const levels = audio.current;
      const agentRaw = speaking ? levels.agent : 0;
      const userRaw = isActive && !connecting ? levels.user : 0;

      const userTalking = userRaw > 0.12 && !speaking;
      const tIdle = speaking || userTalking ? 0 : 1;
      const tUser = userTalking ? 1 : 0;
      const tAgent = speaking ? 1 : 0;

      const targetEnergy = connecting ? 0.8 : speaking ? 1 : isActive ? 0.62 : 0.32;

      if (!primed) {
        // Snap on the first paint. Easing up from zero would render that frame
        // at ~2% intensity — invisible if it is the only frame we get
        // (reduced motion, throttled tab, or a resize repaint).
        wIdle = tIdle; wUser = tUser; wAgent = tAgent;
        energy = targetEnergy;
        smoothAgent = agentRaw;
        smoothUser = userRaw;
        primed = true;
      } else {
        const k = 1 - Math.pow(0.86, dt / 16);
        wIdle += (tIdle - wIdle) * k;
        wUser += (tUser - wUser) * k;
        wAgent += (tAgent - wAgent) * k;
        energy += (targetEnergy - energy) * 0.05;
        smoothAgent += (agentRaw - smoothAgent) * (agentRaw > smoothAgent ? 0.36 : 0.09);
        smoothUser += (userRaw - smoothUser) * (userRaw > smoothUser ? 0.45 : 0.10);
      }

      const wSum = Math.max(0.0001, wIdle + wUser + wAgent);
      const nIdle = wIdle / wSum;
      const nUser = wUser / wSum;
      const nAgent = wAgent / wSum;

      const pal = blendPalettes(nIdle, nUser, nAgent);

      // The single "loudness" the geometry responds to, whoever is speaking.
      const level = clamp01(smoothAgent * nAgent + smoothUser * nUser);
      const bands = levels.bands;
      const treble = nUser > 0.3 ? bands[2] : 0;

      /* ---- canvas ------------------------------------------------------ */
      const light = lightRef.current;
      // Additive blending is what makes neon glow on black. On a light ground
      // it just washes everything to white, so light mode paints normally with
      // darkened, more saturated colour instead.
      const tone = (c: RGB): RGB => (light ? mix(c, [26, 20, 30], 0.34) : c);
      const bloom = light ? 0.35 : 1;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const cx = width / 2;
      const cy = height * ORB.centerY;
      // Height drives the size; the width cap stops the orb overflowing on a
      // narrow screen, where 30% of height would be wider than the display.
      const R =
        Math.min(height * ORB.rHeight, width * ORB.rWidth) * (0.82 + boot * 0.18);

      /* ---- wave geometry ---------------------------------------------- */
      const speed = connecting ? 2.1 : 1;
      const amp = R * (0.05 + energy * 0.028 + level * 0.085 + treble * 0.02);
      const baseY = R * (0.17 + Math.sin(t * 0.31) * 0.03);

      const waveAt = (x: number) => {
        const nx = x / R;
        return (
          baseY +
          amp * 1.0 * Math.sin(nx * 2.15 + t * 0.95 * speed) +
          amp * 0.62 * Math.sin(nx * 3.75 - t * 0.68 * speed + 1.3) +
          amp * 0.34 * Math.sin(nx * 5.4 + t * 1.45 * speed + 2.2)
        );
      };

      const gap = (x: number) => waveAt(x) - Math.sqrt(Math.max(0, R * R - x * x));
      const solve = (lo: number, hi: number) => {
        let a = lo;
        let b = hi;
        for (let i = 0; i < 24; i += 1) {
          const m = (a + b) / 2;
          if (gap(m) < 0) a = m;
          else b = m;
        }
        return (a + b) / 2;
      };
      const xR = solve(0, R);
      const xL = solve(0, -R);

      const angleAt = (x: number) => Math.atan2(-waveAt(x), x); // canvas y is down
      const thetaR = angleAt(xR);
      const thetaL = angleAt(xL);

      /* ---- particle field --------------------------------------------- */
      const push = level * 0.20 + bands[0] * 0.06;
      ctx.globalAlpha = 1;
      for (const m of motes) {
        m.angle += m.speed * 0.004 * (0.5 + energy) * (dt / 16) * motionScale;
        const wob = Math.sin(t * 0.9 + m.phase) * m.wobble;
        const r = R * (m.radius + wob + push);
        const px = cx + Math.cos(m.angle) * r;
        const py = cy + Math.sin(m.angle) * r;

        // Motes below the wave pick up the rim colour, above it the wave colour.
        const belowWave = py > cy - waveAt(px - cx);
        const tint = belowWave
          ? mix(pal.rimNear, pal.rimFar, clamp01((py - (cy - R)) / (2 * R)))
          : waveColour(pal, clamp01((px - cx + R) / (2 * R)), 0.15);

        const nearness = 1 - clamp01(Math.abs(m.radius + wob - 1) * 2.2);
        // Fade out before the bitmap boundary so nothing is ever cut off square.
        const edgeFade = 1 - smoothstep(1.02, 1.16, m.radius + wob + push);
        const alpha = (0.10 + nearness * 0.45) * (0.25 + energy * 0.85) * boot * edgeFade;

        ctx.globalAlpha = clamp01(alpha) * (light ? 1.5 : 1);
        ctx.fillStyle = rgba(tone(tint), 1);
        ctx.beginPath();
        ctx.arc(px, py, m.size * (0.7 + level * 0.9) * (0.5 + boot * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      /* ---- rim: the defining edge -------------------------------------- */
      const rimGrad = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      rimGrad.addColorStop(0, rgba(tone(pal.rimNear), 0.85));
      rimGrad.addColorStop(0.45, rgba(tone(mix(pal.rimNear, pal.rimFar, 0.55)), 0.95));
      rimGrad.addColorStop(1, rgba(tone(pal.rimFar), 1));

      const rimPasses: [number, number][] = [
        [14 + energy * 9 + level * 10, 0.07 * bloom],
        [6.0, 0.2 * bloom],
        [2.6, 1.0],
      ];
      for (const [lineWidth, alpha] of rimPasses) {
        ctx.strokeStyle = rimGrad;
        ctx.globalAlpha = Math.min(1, alpha * (0.7 + energy * 0.45)) * boot;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, R, thetaR, thetaL + Math.PI * 2, false);
        ctx.stroke();
      }

      /* ---- faint upper cap --------------------------------------------- */
      ctx.strokeStyle = rgba(tone(pal.cap), light ? 0.75 : 0.5);
      ctx.globalAlpha = (0.30 + energy * 0.18) * boot;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, thetaL, thetaR, false);
      ctx.stroke();
      ctx.globalAlpha = (0.5 + energy * 0.2) * boot;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, thetaL, thetaR, false);
      ctx.stroke();

      /* ---- ambient bloom ------------------------------------------------ */
      const waveMidY = cy - waveAt(0);
      const halo = ctx.createRadialGradient(cx, waveMidY, 0, cx, waveMidY, R * 1.15);
      const haloStrength = (0.08 + energy * 0.09 + level * 0.24) * boot * bloom;
      const haloColour = tone(pal.wave[1]);
      halo.addColorStop(0, rgba(haloColour, haloStrength));
      halo.addColorStop(0.55, rgba(haloColour, haloStrength * 0.28));
      halo.addColorStop(1, rgba(haloColour, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 1.2, waveMidY - R * 1.2, R * 2.4, R * 2.4);

      const pool = ctx.createRadialGradient(cx, cy + R * 0.55, 0, cx, cy + R * 0.55, R * 0.95);
      const poolStrength = (0.06 + energy * 0.08 + level * 0.12) * boot * bloom;
      pool.addColorStop(0, rgba(tone(pal.rimFar), poolStrength));
      pool.addColorStop(1, rgba(tone(pal.rimFar), 0));
      ctx.fillStyle = pool;
      ctx.fillRect(cx - R * 1.1, cy - R * 0.4, R * 2.2, R * 2);

      /* ---- the fluid wave ---------------------------------------------- */
      // The wave runs far past the rim; xL/xR above are only used to split the
      // bright lower arc from the faint cap.
      const reach = R * (1 + ORB.extend);
      const nodes: { x: number; y: number; p: number; intensity: number; tail: number }[] = [];

      for (let i = 0; i < SEGMENTS; i += 1) {
        const p = i / (SEGMENTS - 1);
        const x = lerp(-reach, reach, p);
        const y = waveAt(x);

        const h = R * 0.008;
        const slope = (waveAt(x + h) - waveAt(x - h)) / (2 * h);
        const flatness = 1 - clamp01(Math.abs(slope) * 1.6);
        const heightN = clamp01((y - baseY + amp) / (amp * 2));
        const crest = flatness * heightN;

        // Outside the circle the line thins and dims. Without this a long wave
        // reads as a bar laid across the screen rather than a wave with tails.
        const outside = clamp01((Math.abs(x) - R * 0.94) / (R * ORB.extend));
        const tail = Math.pow(1 - outside, 1 + ORB.taper);

        const intensity = clamp01(crest * (0.55 + level * 0.75)) * (0.3 + tail * 0.7);

        nodes.push({ x: cx + x, y: cy - y, p, intensity, tail });
      }

      const wavePasses: [number, number, number][] = [
        [7.5 + energy * 4 + level * 6, 0.05 * bloom, 0],
        [3.0, 0.17 * bloom, 0.25],
        [1.0, 0.92, 0.6],
      ];
      for (const [widthScale, alpha, hotBias] of wavePasses) {
        for (let i = 0; i < nodes.length - 1; i += 1) {
          const a = nodes[i];
          const b = nodes[i + 1];
          const tail = (a.tail + b.tail) / 2;
          if (tail <= 0.004) continue;
          const intensity = (a.intensity + b.intensity) / 2;
          const w = (1.5 + intensity * 3.4 + level * 1.8) * widthScale * 0.42 * (0.3 + tail * 0.7);

          ctx.strokeStyle = rgba(
            tone(waveColour(pal, a.p, Math.min(1, intensity + hotBias * intensity))),
            1
          );
          ctx.globalAlpha =
            alpha * (0.5 + energy * 0.65) * (0.55 + intensity * 0.65) * boot * tail;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* ---- flares where the wave strikes the rim ------------------------ */
      for (const ex of [xL, xR]) {
        const end = { x: cx + ex, y: cy - waveAt(ex) };
        const flare = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, R * 0.16);
        const s = (0.32 + energy * 0.28 + level * 0.34) * boot * (light ? 0.5 : 1);
        flare.addColorStop(0, rgba(tone(pal.hot), s));
        flare.addColorStop(0.4, rgba(tone(pal.wave[1]), s * 0.35));
        flare.addColorStop(1, rgba(tone(pal.wave[1]), 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = flare;
        ctx.beginPath();
        ctx.arc(end.x, end.y, R * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ---- sparks: embers thrown off on peaks --------------------------- */
      peakHold = Math.max(0, peakHold - dt);
      if (!reduceMotion && level > 0.28 && peakHold <= 0) {
        peakHold = 45;
        const count = 2 + Math.round(level * 5);
        for (let i = 0; i < count; i += 1) {
          // Only from the bright section — embers flying off an invisible tail
          // at the screen edge would look like stray dots.
          const lit = nodes.filter((n) => n.tail > 0.55);
          const node = lit[Math.floor(Math.random() * lit.length)] ?? nodes[0];
          const dir = Math.atan2(node.y - cy, node.x - cx) + (Math.random() - 0.5) * 0.9;
          const sp = (0.4 + Math.random() * 1.5) * (0.6 + level);
          emit(node.x, node.y, Math.cos(dir) * sp, Math.sin(dir) * sp - 0.25, node.p);
        }
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= s.decay * (dt / 16);
        s.x += s.vx * (dt / 16);
        s.y += s.vy * (dt / 16);
        s.vy += 0.006 * (dt / 16); // gentle settle
        s.vx *= 0.995;
        if (s.life <= 0) continue;

        ctx.globalAlpha = clamp01(s.life * 0.85) * boot;
        ctx.fillStyle = rgba(tone(waveColour(pal, s.tint, 0.55)), 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.4 + s.life * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }

      /* ---- connecting sweep --------------------------------------------- */
      if (connecting) {
        const sweep = (now % 1100) / 1100;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = rgba(tone(pal.rimFar), 1);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.92, sweep * Math.PI * 2, sweep * Math.PI * 2 + 1.1);
        ctx.stroke();
      }

      /* ---- soften the canvas boundary ------------------------------------
         Anything that reaches the edge of the bitmap gets clipped into a hard
         straight line. Erasing a ring of alpha at the rim guarantees a smooth
         falloff instead, whatever was drawn. */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(cx, cy);
      // Stretched horizontally so the tails survive to the screen edge while
      // the top and bottom still fall off. A circular fade would cut them.
      ctx.scale(ORB.fadeX, 1);
      const inner = (height / 2) * 0.78;
      const edge = ctx.createRadialGradient(0, 0, inner, 0, 0, (height / 2) * 1.05);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = edge;
      ctx.fillRect(-width, -height, width * 2, height * 2);
      ctx.restore();

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    repaint = () => draw(performance.now());
    draw(performance.now());

    let frames = 0;
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      frames += 1;
      draw(time);
    };
    raf = requestAnimationFrame(loop);

    // Some embedded webviews and non-compositing panes never fire rAF at all.
    // If no frames have landed shortly after mount, drive the loop from a
    // timer instead so the orb still lives. 250ms is long enough for a healthy
    // browser to have painted ~15 frames, and short enough that the fallback
    // path has no visible dead time.
    let timer = 0;
    const watchdog = window.setTimeout(() => {
      if (frames < 2) {
        console.warn('[vara] requestAnimationFrame is not firing — using a timer fallback');
        cancelAnimationFrame(raf);
        raf = 0;
        timer = window.setInterval(() => draw(performance.now()), 33);
      }
    }, 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      if (timer) window.clearInterval(timer);
      observer.disconnect();
    };
  }, [audio]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
