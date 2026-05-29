import { useEffect } from 'react';
import gsap from 'gsap';

export function usePageAnimation(refs, deps = []) {
  useEffect(() => {
    const items = Array.isArray(refs) ? refs : [refs];
    const valid = items.filter(Boolean);

    if (valid.length === 0) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    valid.forEach((ref, i) => {
      if (ref && ref.current) {
        if (i === 0) {
          tl.fromTo(ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
        } else {
          tl.fromTo(ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3');
        }
      }
    });

    return () => { tl.kill(); };
  }, deps);
}

export function useStaggerAnimation(containerRef, selector = '> *', deps = []) {
  useEffect(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll(selector);
    if (children.length === 0) return;

    gsap.fromTo(
      children,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' }
    );
  }, deps);
}
