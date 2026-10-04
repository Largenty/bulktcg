"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ACCEPTED_PHOTO_TYPES } from "@/lib/photo-files";

type PhotoDropzoneProps = {
  onFiles: (files: File[]) => void;
  describedBy: string;
  hasError: boolean;
};

/* La zone où l'on glisse ses photos, et le bouton qui ouvre le sélecteur de
   fichiers du système pour qui ne glisse pas. Le tri — format, poids,
   nombre — est l'affaire de PhotoPicker. */
export function PhotoDropzone({ onFiles, describedBy, hasError }: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={`flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width-strong)] border-dashed p-6 text-center transition-colors ${
        isDragging ? "border-[var(--ink)] bg-[var(--tint)]" : "border-[var(--line-strong)] bg-[var(--card)]"
      } ${hasError ? "border-[var(--danger)]" : ""}`}
    >
      <Icon name="image" size={30} strokeWidth={1.6} className="text-[var(--ink-soft)]" />
      <p className="text-[length:var(--text-md)] text-[var(--ink-soft)]">Glissez vos photos ici, ou</p>
      <button
        id="photo-picker"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-describedby={describedBy}
        className="btn btn-secondary btn-sm"
      >
        <Icon name="upload" size={16} />
        Choisir des photos
      </button>
      <input
        ref={inputRef}
        id="photo-files"
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          onFiles([...(event.currentTarget.files ?? [])]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
