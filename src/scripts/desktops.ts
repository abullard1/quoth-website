import gsap from 'gsap';

/**
 * Fits-in animation. One desktop; the Quoth pill opens on it; then the frame
 * splits into six smaller desktops, one per distro, each with its logo as the
 * wallpaper and its own pill. Loops.
 */
const SCALE = 0.3;
const GRID = [
  { x: 16, y: 60 }, { x: 224, y: 60 }, { x: 432, y: 60 },
  { x: 16, y: 220 }, { x: 224, y: 220 }, { x: 432, y: 220 },
];

export function mountDesktops(): void {
  const svg = document.getElementById('desktops');
  if (!svg) return;
  const one = svg.querySelector<SVGGElement>('#dk-one');
  const pill = svg.querySelector<SVGGElement>('#dk-pill');
  const bars = Array.from(svg.querySelectorAll<SVGRectElement>('.dk-bar'));
  const frames = Array.from(svg.querySelectorAll<SVGGElement>('.dk'));
  const logos = Array.from(svg.querySelectorAll<SVGPathElement>('.dk-logo'));
  const minis = Array.from(svg.querySelectorAll<SVGGElement>('.dk-mini'));
  if (!one || !pill || frames.length !== GRID.length) return;

  const settled = () => {
    gsap.set(one, { opacity: 0 });
    gsap.set(frames, { opacity: 1, transformOrigin: '0 0', x: (i: number) => GRID[i].x, y: (i: number) => GRID[i].y, scale: SCALE });
    gsap.set(logos, { attr: { 'fill-opacity': 0.22 } });
    gsap.set(minis, { opacity: 1 });
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settled();
    return;
  }

  const rest = bars.map((b) => Number(b.getAttribute('height')));
  bars.forEach((bar, i) => {
    gsap.to(bar, {
      attr: { height: () => rest[i] * gsap.utils.random(0.4, 1.4) },
      duration: gsap.utils.random(0.22, 0.4),
      repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.04,
      onUpdate() { bar.setAttribute('y', String(-Number(bar.getAttribute('height')) / 2)); },
    });
  });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, defaults: { ease: 'expo.inOut' } });
  tl.set(one, { opacity: 1 })
    .set(pill, { opacity: 0, y: 40, transformOrigin: '50% 50%' })
    .set(frames, { opacity: 0, transformOrigin: '0 0', x: 0, y: 0, scale: 1 })
    .set(logos, { attr: { 'fill-opacity': 0 } })
    .set(minis, { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' })
    // the pill opens on the one desktop
    .to(pill, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.4)' }, 0.6)
    .to({}, { duration: 1.6 })
    // split: six frames appear on top of the one, then fly to the grid
    .to(frames, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 'split')
    .to(one, { opacity: 0, duration: 0.3 }, 'split+=0.15')
    .to(frames, {
      x: (i: number) => GRID[i].x, y: (i: number) => GRID[i].y, scale: SCALE,
      duration: 1.1, stagger: 0.05,
    }, 'split+=0.2')
    // wallpapers and pills
    .to(logos, { attr: { 'fill-opacity': 0.22 }, duration: 0.6, stagger: 0.07, ease: 'power2.out' }, 'split+=1.0')
    .to(minis, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.07, ease: 'back.out(1.6)' }, 'split+=1.25')
    .to({}, { duration: 2.6 })
    .to(frames, { opacity: 0, duration: 0.5, ease: 'power2.in' });

  tl.pause();
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.25 });
  io.observe(svg);
}
