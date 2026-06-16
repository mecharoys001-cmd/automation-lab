"use client";

import {
  Columns,
  Image as ImageIcon,
  LayoutGrid,
  Rows,
  Square,
  X,
} from "lucide-react";
import type { AdLayoutType, AdPageConfig } from "../../lib/types";

interface Props {
  config: AdPageConfig;
  onUpdate: (config: AdPageConfig) => void;
  onDelete: (id: string) => void;
}

export function AdPage({ config, onUpdate, onDelete }: Props) {
  const handleLayoutChange = (type: AdLayoutType) => {
    let slots = 1;
    if (type === "half-horizontal" || type === "half-vertical") slots = 2;
    if (type === "grid-4") slots = 4;

    const newImages = [...config.images].slice(0, slots);
    while (newImages.length < slots) newImages.push(null);

    onUpdate({ ...config, layout: type, images: newImages });
  };

  const handleImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newImages = [...config.images];
      newImages[index] = e.target?.result as string;
      onUpdate({ ...config, images: newImages });
    };
    reader.readAsDataURL(file);
  };

  const renderSlot = (index: number, className: string = "") => {
    const hasImage = !!config.images[index];
    return (
      <div
        className={`relative bg-gray-50 border border-gray-200 overflow-hidden group/slot ${className}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(index, e.dataTransfer.files[0]);
          }
        }}
      >
        {hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.images[index]!}
              className="w-full h-full object-cover"
              alt="Ad"
            />
            <button
              onClick={() => {
                const newImages = [...config.images];
                newImages[index] = null;
                onUpdate({ ...config, images: newImages });
              }}
              className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 opacity-0 group-hover/slot:opacity-100 transition-opacity print:hidden hover:bg-red-50"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer text-gray-300 hover:bg-gray-100 hover:text-gray-400 transition-colors">
            <ImageIcon size={32} />
            <span className="text-xs font-bold uppercase mt-2">Drop Image</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) =>
                e.target.files && handleImageUpload(index, e.target.files[0])
              }
            />
          </label>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (config.layout) {
      case "full":
        return renderSlot(0, "w-full h-full");
      case "half-horizontal":
        return (
          <div className="flex flex-col w-full h-full">
            {renderSlot(0, "h-1/2 w-full")}
            {renderSlot(1, "h-1/2 w-full border-t-0")}
          </div>
        );
      case "half-vertical":
        return (
          <div className="flex w-full h-full">
            {renderSlot(0, "w-1/2 h-full")}
            {renderSlot(1, "w-1/2 h-full border-l-0")}
          </div>
        );
      case "grid-4":
        return (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
            {renderSlot(0)}
            {renderSlot(1)}
            {renderSlot(2)}
            {renderSlot(3)}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full relative group">
      <div className="absolute top-[-40px] left-0 w-full flex justify-between items-center bg-white border border-gray-200 p-1.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-50 print:hidden">
        <div className="flex gap-1">
          <button
            onClick={() => handleLayoutChange("full")}
            className={`p-1 rounded hover:bg-gray-100 ${
              config.layout === "full" ? "text-blue-600 bg-blue-50" : "text-gray-500"
            }`}
            title="Full Page"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => handleLayoutChange("half-horizontal")}
            className={`p-1 rounded hover:bg-gray-100 ${
              config.layout === "half-horizontal"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-500"
            }`}
            title="2 Horizontal"
          >
            <Rows size={16} />
          </button>
          <button
            onClick={() => handleLayoutChange("half-vertical")}
            className={`p-1 rounded hover:bg-gray-100 ${
              config.layout === "half-vertical"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-500"
            }`}
            title="2 Vertical"
          >
            <Columns size={16} />
          </button>
          <button
            onClick={() => handleLayoutChange("grid-4")}
            className={`p-1 rounded hover:bg-gray-100 ${
              config.layout === "grid-4" ? "text-blue-600 bg-blue-50" : "text-gray-500"
            }`}
            title="4 Grid"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
        <button
          onClick={() => onDelete(config.id)}
          className="text-red-500 p-1 hover:bg-red-50 rounded"
        >
          <X size={16} />
        </button>
      </div>

      {renderContent()}
    </div>
  );
}
