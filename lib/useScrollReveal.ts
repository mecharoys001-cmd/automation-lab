"use client";
import { useEffect } from "react";

/**
 * Wires up IntersectionObserver on all [data-reveal] elements.
 * When an element enters the viewport, the `revealed` attribute is set,
 * which triggers the CSS animation. Elements start hidden via CSS.
 */
export function useScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.delay ?? "0";
            setTimeout(() => {
              el.setAttribute("data-revealed", "true");
            }, Number(delay));
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
