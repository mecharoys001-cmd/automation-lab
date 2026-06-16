"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Columns,
  GripHorizontal,
  Image as ImageIcon,
  LayoutList,
  Palette,
  Scaling,
  Sparkles,
  Square,
  Type,
  X,
} from "lucide-react";
import type { CardStyles } from "../../lib/types";

interface Props {
  styles: CardStyles;
  onChange: (next: CardStyles) => void;
  onClose: () => void;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r, g, b);
  const cmax = Math.max(r, g, b);
  const delta = cmax - cmin;
  let h = 0;
  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (cmax + cmin) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

export default function StyleControls({ styles, onChange, onClose }: Props) {
  const set = <K extends keyof CardStyles>(key: K, value: CardStyles[K]) => {
    onChange({ ...styles, [key]: value });
  };

  const applySmartTheme = (baseColor: string) => {
    const { h, s, l } = hexToHsl(baseColor);
    const headerL = Math.min(0.9, l + (1 - l) * 0.6);
    const workshopHeader = hslToHex(h, Math.max(0, s * 0.8), headerL);
    const bgL = Math.min(0.97, l + (1 - l) * 0.92);
    const workshopBg = hslToHex(h, Math.max(0, s * 0.6), bgL);
    onChange({
      ...styles,
      dateHeaderBgColor: baseColor,
      monthTitleColor: baseColor,
      websiteLinkColor: baseColor,
      workshopHeaderBgColor: workshopHeader,
      workshopBgColor: workshopBg,
    });
  };

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 640) return;
    if (e.button !== 0) return;
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!position) setPosition({ x: rect.left, y: rect.top });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const positionStyle: React.CSSProperties = position
    ? { top: `${position.y}px`, left: `${position.x}px`, bottom: "auto", right: "auto" }
    : {};

  return (
    <div
      ref={panelRef}
      style={positionStyle}
      className="fixed inset-x-0 bottom-0 top-auto z-[60] flex h-[70vh] flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-xl sm:inset-auto sm:bottom-auto sm:left-4 sm:top-20 sm:h-auto sm:w-72 sm:rounded-lg"
      role="dialog"
      aria-label="Card style editor"
    >
      <div
        className="flex shrink-0 cursor-grab select-none items-center justify-between border-b border-slate-100 bg-slate-50 p-3 active:cursor-grabbing"
        onMouseDown={onHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="hidden text-slate-400 sm:block" />
          <h3 className="text-sm font-bold text-slate-700">Card Style Editor</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Close style editor"
          title="Close style editor"
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-full space-y-5 overflow-y-auto p-4 sm:h-[calc(100vh-200px)]">
        <section className="mb-2 border-b border-slate-100 pb-4 pt-1">
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Columns size={12} /> Layout
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <label>Middle Gutter (Fold)</label>
              <span>{styles.columnGap ?? 16}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={100}
              step={4}
              value={styles.columnGap ?? 16}
              onChange={(e) => set("columnGap", parseInt(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              title="Space between the two calendar columns (fold gutter)"
            />
          </div>
        </section>

        <section className="mb-2 border-b border-slate-100 pb-4">
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Palette size={12} /> Colors
          </h4>

          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-800">
              <Sparkles size={12} /> Smart Theme
            </label>
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full shadow-sm ring-2 ring-white transition-transform hover:scale-110">
                <input
                  type="color"
                  className="absolute -left-1/2 -top-1/2 m-0 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                  onChange={(e) => applySmartTheme(e.target.value)}
                  aria-label="Smart theme base color"
                  title="Pick a primary brand color"
                />
              </div>
              <span className="text-xs leading-tight text-blue-600">
                Pick a base color to auto-generate a harmonious palette.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: "monthTitleColor", label: "Month Title", title: "Color of the large month/year title" },
              { key: "dateHeaderBgColor", label: "Date Headers", title: "Background color of daily date headers" },
              { key: "workshopHeaderBgColor", label: "Workshop Headers", title: "Background color of workshop section headers" },
              { key: "workshopBgColor", label: "Workshop Background", title: "Background fill for workshop cards" },
              { key: "websiteLinkColor", label: "Website Links", title: "Color used for the venue website links on event cards" },
            ].map(({ key, label, title }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-xs text-slate-600" title={title}>
                  {label}
                </label>
                <input
                  type="color"
                  value={(styles as unknown as Record<string, string>)[key] ?? "#7FA5BC"}
                  onChange={(e) => set(key as keyof CardStyles, e.target.value as never)}
                  className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
                  title={title}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-2 border-b border-slate-100 pb-4">
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <LayoutList size={12} /> Headers
          </h4>
          <div className="mb-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <label>Padding (Height)</label>
                <span>{styles.dateHeaderPadding}px</span>
              </div>
              <input
                type="range"
                min={-12}
                max={32}
                step={1}
                value={styles.dateHeaderPadding}
                onChange={(e) => set("dateHeaderPadding", parseInt(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                title="Vertical padding on date headers"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Width Mode</label>
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => set("headerWidth", "full")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs transition-all ${
                    styles.headerWidth !== "fit"
                      ? "bg-white font-bold text-blue-600 shadow"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Header spans the full column width"
                >
                  <Scaling size={12} className="rotate-90" /> Full Width
                </button>
                <button
                  type="button"
                  onClick={() => set("headerWidth", "fit")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs transition-all ${
                    styles.headerWidth === "fit"
                      ? "bg-white font-bold text-blue-600 shadow"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Header is sized to fit its text"
                >
                  <Scaling size={12} /> Fit Text
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Square size={12} /> Cards
          </h4>

          <div className="mb-4 space-y-4">
            <div className="mb-2 flex items-center gap-1 border-b border-slate-50 pb-1 text-xs font-semibold text-slate-600">
              <Type size={10} /> Typography
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <label>Line Height</label>
                <span>{styles.lineHeight ?? 1.1}</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.8}
                step={0.05}
                value={styles.lineHeight ?? 1.1}
                onChange={(e) => set("lineHeight", parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                title="Vertical spacing between lines of text inside event cards"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <label>Kerning (Spacing)</label>
                <span>{styles.letterSpacing ?? -0.01}em</span>
              </div>
              <input
                type="range"
                min={-0.1}
                max={0.1}
                step={0.005}
                value={styles.letterSpacing ?? -0.01}
                onChange={(e) => set("letterSpacing", parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                title="Letter spacing applied to event card text"
              />
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Border Mode</span>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => set("showBottomBorder", true)}
                className={`rounded-md p-1.5 transition-all ${
                  styles.showBottomBorder
                    ? "bg-white text-blue-600 shadow"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Show only a divider line at the bottom of each card"
              >
                <AlignLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => set("showBottomBorder", false)}
                className={`rounded-md p-1.5 transition-all ${
                  !styles.showBottomBorder
                    ? "bg-white text-blue-600 shadow"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Show a full box border around each card"
              >
                <Square size={16} />
              </button>
            </div>
          </div>

          <div className="mb-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <label>Border Width</label>
              <span>{styles.borderWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={styles.borderWidth}
              onChange={(e) => set("borderWidth", parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              title="Thickness of the card border"
            />
          </div>

          <div className="mb-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <label>Internal Padding (Box)</label>
              <span>{styles.padding}px</span>
            </div>
            <input
              type="range"
              min={-30}
              max={40}
              step={1}
              value={styles.padding}
              onChange={(e) => set("padding", parseInt(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              title="Padding inside each event card"
            />
          </div>

          <div className="mb-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <label>Border Radius</label>
              <span>{styles.borderRadius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={styles.borderRadius}
              onChange={(e) => set("borderRadius", parseInt(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              title="Corner roundness on event cards"
            />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-500">Style</label>
              <select
                value={styles.borderStyle}
                onChange={(e) =>
                  set("borderStyle", e.target.value as CardStyles["borderStyle"])
                }
                className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                title="Card border line style"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-500">Color</label>
              <input
                type="color"
                value={styles.borderColor}
                onChange={(e) => set("borderColor", e.target.value)}
                className="h-7 w-full cursor-pointer rounded border border-slate-200 p-0.5"
                title="Card border color"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              <ImageIcon size={12} /> Sponsors
            </h4>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <label>Spacing (Top)</label>
                  <span>{styles.sponsorPaddingTop ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={60}
                  step={1}
                  value={styles.sponsorPaddingTop ?? 0}
                  onChange={(e) => set("sponsorPaddingTop", parseInt(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                  title="Padding above inline sponsor blocks"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <label>Spacing (Bottom)</label>
                  <span>{styles.sponsorPaddingBottom ?? 16}px</span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={60}
                  step={1}
                  value={styles.sponsorPaddingBottom ?? 16}
                  onChange={(e) =>
                    set("sponsorPaddingBottom", parseInt(e.target.value))
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                  title="Padding below inline sponsor blocks"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
