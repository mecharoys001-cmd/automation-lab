"use client";
import { useScrollReveal } from "@/lib/useScrollReveal";

/** Mount this once in the layout to wire up scroll animations globally. */
export default function ScrollRevealProvider() {
  useScrollReveal();
  return null;
}
