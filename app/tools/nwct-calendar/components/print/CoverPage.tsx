"use client";

import { useRef } from "react";
import { ImagePlus, Upload } from "lucide-react";
import type { CoverConfig } from "../../lib/types";

interface Props {
  config: CoverConfig;
  onUpdate: (config: CoverConfig) => void;
}

export function CoverPage({ config, onUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onUpdate({ ...config, heroImageUrl: ev.target?.result as string });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onUpdate({ ...config, heroImageUrl: ev.target?.result as string });
      };
      reader.readAsDataURL(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-black"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleDrop}
    >
      {config.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.heroImageUrl}
          className="absolute inset-0 w-full h-full object-cover z-0"
          alt="Cover Hero"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-gray-500 z-0 pointer-events-none">
          <ImagePlus size={48} className="mb-2 opacity-50" />
          <span className="text-sm font-bold uppercase tracking-widest">
            Drop Cover Image Here
          </span>
        </div>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/90 text-white hover:text-black p-2 rounded-full transition-all print:hidden"
        title="Upload cover image"
      >
        <Upload size={16} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />

      <div className="absolute top-0 left-0 w-full p-8 z-10 flex flex-col items-center">
        <h1 className="header-font text-white font-bold text-[42px] uppercase text-center drop-shadow-lg w-full">
          {config.title}
        </h1>
        <input
          value={config.month}
          onChange={(e) => onUpdate({ ...config, month: e.target.value })}
          className="header-font bg-transparent text-white font-bold text-[24px] uppercase text-center w-full outline-none mt-2 placeholder-white/50 drop-shadow-md"
          placeholder="DECEMBER 2025"
        />
      </div>

      <div className="absolute bottom-8 left-8 right-8 z-10 flex justify-between items-end">
        <div className="w-1/2">
          <textarea
            value={config.credit}
            onChange={(e) => onUpdate({ ...config, credit: e.target.value })}
            className="header-font bg-transparent text-white text-[14px] uppercase font-bold w-full outline-none resize-none overflow-hidden placeholder-white/50 drop-shadow-md"
            rows={3}
            placeholder="Photo by: ..."
          />
        </div>
        <div className="text-right">
          <div className="header-font text-white text-[24px] font-bold uppercase leading-tight drop-shadow-md">
            {config.subtitle1}
          </div>
          <div className="header-font text-white text-[24px] font-bold uppercase leading-tight drop-shadow-md">
            {config.subtitle2}
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-0" />
    </div>
  );
}
