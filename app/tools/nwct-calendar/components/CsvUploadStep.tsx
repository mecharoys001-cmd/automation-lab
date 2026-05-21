"use client";

import { useCallback, useState } from "react";

interface Props {
  onFileLoaded: (text: string, fileName: string) => void;
  onLoadProject: () => void;
  hasAutosave: boolean;
  onRestoreAutosave: () => void;
  onLoadSample: () => void;
  onStartBlank: () => void;
  error: string | null;
}

export default function CsvUploadStep({
  onFileLoaded,
  onLoadProject,
  hasAutosave,
  onRestoreAutosave,
  onLoadSample,
  onStartBlank,
  error,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFileLoaded(text, file.name);
      };
      reader.readAsText(file);
    },
    [onFileLoaded],
  );

  return (
    <div className="flex flex-col items-center">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) readFile(file);
        }}
        className={`flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? "border-amber-400 bg-amber-400/10"
            : "border-border bg-card hover:border-muted-foreground"
        }`}
        title="Upload your monthly events CSV (the script-exported Airtable CSV works as-is)"
      >
        <svg
          className="mb-4 h-16 w-16 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <span className="mb-2 text-lg font-semibold text-foreground">
          Drop your events CSV here
        </span>
        <span className="mb-4 text-sm text-muted-foreground">
          or click to browse files
        </span>
        <span className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700">
          Select CSV File
        </span>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
          className="hidden"
          aria-label="Upload events CSV"
        />
      </label>

      <p className="mt-4 max-w-2xl text-center text-xs text-muted-foreground/80">
        Expected columns: <code>Title, Venue, Town, Website, Start At, End At, Times, Run Type, Image URL</code>.
        Headers close to these will be auto-mapped — you can review on the next step.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onLoadSample}
          className="rounded-lg border border-blue-500/40 bg-blue-50 px-4 py-2 text-sm text-blue-900 transition-colors hover:bg-blue-100"
          title="Load a built-in sample month so you can explore the editor without your own data"
        >
          Load Sample
        </button>
        <button
          onClick={onStartBlank}
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
          title="Skip the CSV step and open an empty calendar for layout work"
        >
          Start Blank
        </button>
        <button
          onClick={onLoadProject}
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
          title="Load a previously saved Calendar Automator project JSON"
        >
          Load project JSON…
        </button>
        {hasAutosave && (
          <button
            onClick={onRestoreAutosave}
            className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 transition-colors hover:bg-amber-100"
            title="Restore the most recent autosaved session from this browser"
          >
            Restore last session
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
