import gsap from 'gsap';

/** Fits-in animation: four desktops converge into one, then the pill opens. */
export function mountDesktops(): void {
  const svg = document.getElementById('desktops');
  if (!svg) return;
  const four = Array.from(svg.querySelectorAll<SVGGElement>('.dk'));
  const one = svg.querySelector<SVGGElement>('#dk-one');
  const pill = svg.querySelector<SVGGElement>('#dk-pill');
  const bars = Array.from(svg.querySelectorAll<SVGRectElement>('.dk-bar'));
  if (!one || !pill || four.length !== 4) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(four, { opacity: 0 });
    gsap.set([one, pill], { opacity: 1 });
    return;
  }

  const starts = [
    { x: 60, y: 40 }, { x: 360, y: 30 }, { x: 40, y: 210 }, { x: 340, y: 200 },
  ];
  const rest = bars.map((b) => Number(b.getAttribute('height')));
  bars.forEach((bar, i) => {
    gsap.to(bar, {
      attr: { height: () => rest[i] * gsap.utils.random(0.4, 1.5) },
      duration: gsap.utils.random(0.22, 0.4),
      repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.04,
      onUpdate() { bar.setAttribute('y', String(-Number(bar.getAttribute('height')) / 2)); },
    });
  });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: 'expo.inOut' } });
  tl.set(four, { opacity: 1, transformOrigin: '0 0' })
    .set(four.map((_, i) => four[i]), { x: (i: number) => starts[i].x, y: (i: number) => starts[i].y, scale: 0.42 })
    .set([one, pill], { opacity: 0 })
    .set(pill, { scale: 0.9, transformOrigin: '50% 50%' })
    .to({}, { duration: 1.0 })
    // converge: all four grow into the same full frame
    .to(four, { x: 0, y: 0, scale: 1, duration: 1.3, stagger: 0.06 }, 'merge')
    .to(four, { opacity: 0.35, duration: 0.6 }, 'merge+=0.5')
    .to(one, { opacity: 1, duration: 0.6 }, 'merge+=0.9')
    .to(four, { opacity: 0, duration: 0.3 }, 'merge+=1.2')
    // the pill opens
    .to(pill, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, 'merge+=1.5')
    .to({}, { duration: 2.4 })
    .to([one, pill], { opacity: 0, duration: 0.5, ease: 'power2.in' });

  tl.pause();
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.25 });
  io.observe(svg);
}
