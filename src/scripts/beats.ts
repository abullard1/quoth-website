import gsap from 'gsap';

/**
 * How-it-works animation. One rect morphs through three states on a loop:
 * key cap (press), pill with waveform (speak), caret writing a line (done).
 * The step list below highlights in sync.
 */
const SENTENCE = 'Your words, exactly where you want them.';

const KEY = { x: 280, y: 70, width: 80, height: 80, rx: 20 };
const PILL = { x: 210, y: 82, width: 220, height: 56, rx: 28 };
const CARET = { x: 120, y: 96, width: 3, height: 28, rx: 1.5 };

export function mountBeats(): void {
  const svg = document.getElementById('beats');
  const shape = document.getElementById('b-shape');
  const ring = document.getElementById('b-ring');
  const wave = document.getElementById('b-wave');
  const text = document.getElementById('b-text') as SVGTextElement | null;
  const steps = Array.from(document.querySelectorAll<HTMLElement>('.beat-step'));
  if (!svg || !shape || !ring || !wave || !text) return;

  const setActive = (key: string | null) => {
    for (const s of steps) s.dataset.active = key === null ? '' : String(s.dataset.step === key);
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Rest frame: the sentence written, caret parked at its end.
    text.textContent = SENTENCE;
    gsap.set(text, { opacity: 1 });
    const end = CARET.x + text.getComputedTextLength() + 6;
    gsap.set(shape, { attr: { ...CARET, x: end } });
    return;
  }

  const bars = Array.from(wave.querySelectorAll<SVGRectElement>('.b-bar'));
  const rest = bars.map((b) => Number(b.getAttribute('height')));
  // The waveform breathes on its own clock; it only shows during the speak beat.
  bars.forEach((bar, i) => {
    gsap.to(bar, {
      attr: { height: () => rest[i] * gsap.utils.random(0.35, 1.4) },
      y: () => 0,
      duration: gsap.utils.random(0.22, 0.4),
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: i * 0.04,
      onUpdate() {
        const h = Number(bar.getAttribute('height'));
        bar.setAttribute('y', String(110 - h / 2));
      },
    });
  });

  const typed = { n: 0 };
  const write = () => {
    text.textContent = SENTENCE.slice(0, Math.round(typed.n));
    const w = text.textContent ? text.getComputedTextLength() : 0;
    shape.setAttribute('x', String(CARET.x + w + (w ? 6 : 0)));
  };

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, defaults: { ease: 'expo.inOut' } });
  tl.call(() => setActive('press'))
    .set(shape, { attr: KEY, transformOrigin: '50% 50%', scale: 1 })
    .set(ring, { attr: { r: 52, 'stroke-opacity': 0 } })
    .set(text, { opacity: 0 })
    .set(wave, { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' })
    .set(typed, { n: 0 })
    // press
    .to(shape, { scale: 0.92, duration: 0.18, ease: 'power2.in' }, 0.5)
    .to(ring, { attr: { r: 84, 'stroke-opacity': 0.45 }, duration: 0.05, ease: 'none' }, 0.62)
    .to(ring, { attr: { r: 118, 'stroke-opacity': 0 }, duration: 0.8, ease: 'power2.out' }, 0.67)
    .to(shape, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.6)' }, 0.68)
    // speak: key becomes the pill, waveform fades in
    .call(() => setActive('speak'), [], 1.25)
    .to(shape, { attr: PILL, duration: 0.7 }, 1.25)
    .to(wave, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.45, ease: 'power2.out' }, 1.45)
    .to({}, { duration: 2.1 })
    // done: waveform out, pill collapses to a caret, the caret writes
    .call(() => setActive('done'), [], 4.15)
    .to(wave, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 4.15)
    .to(shape, { attr: CARET, duration: 0.6 }, 4.3)
    .set(text, { opacity: 1 }, 4.9)
    .to(typed, { n: SENTENCE.length, duration: 1.9, ease: 'none', onUpdate: write }, 4.95)
    .to({}, { duration: 1.4 })
    // reset for the loop
    .to(text, { opacity: 0, duration: 0.35, ease: 'power2.in' })
    .call(() => setActive('press'))
    .to(shape, { attr: KEY, duration: 0.7 }, '<0.1');

  // Only spend frames while the stage is on screen.
  tl.pause();
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.2 });
  io.observe(svg);
}
