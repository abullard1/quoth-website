import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Scroll-in reveals for anything marked .reveal. Grouped siblings stagger. */
export function initReveals(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  const groups = new Map<Element, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    const key = el.closest('[data-reveal-group]') ?? el;
    const list = groups.get(key) ?? [];
    list.push(el);
    groups.set(key, list);
  });

  groups.forEach((els, key) => {
    gsap.to(els, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: els.length > 1 ? 0.08 : 0,
      scrollTrigger: { trigger: key, start: 'top 85%', once: true },
    });
  });
}
