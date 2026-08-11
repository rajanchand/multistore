'use client';

import { useRef, useState } from 'react';
import { GripVertical, ImagePlus, Star, Trash2, Upload } from 'lucide-react';
import { Button, Input } from '@repo/ui';

const MAX_IMAGES = 12;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function ProductImageEditor({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addUrl() {
    setError(null);
    const url = urlInput.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('Image URL must be http(s)');
        return;
      }
    } catch {
      setError('Enter a valid image URL');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images`);
      return;
    }
    if (images.includes(url)) {
      setError('Image already added');
      return;
    }
    onChange([...images, url]);
    setUrlInput('');
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function makePrimary(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.unshift(item);
    onChange(next);
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDrop(index: number) {
    if (dragIndex == null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    const next = [...images];
    const [item] = next.splice(dragIndex, 1);
    if (!item) {
      setDragIndex(null);
      return;
    }
    next.splice(index, 0, item);
    onChange(next);
    setDragIndex(null);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_IMAGES} images`);
      return;
    }

    const added: string[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError('Only JPEG, PNG, WebP, or GIF files are allowed');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('Each file must be under 2MB (use a URL for larger assets)');
        continue;
      }
      const dataUrl = await readAsDataUrl(file);
      added.push(dataUrl);
    }
    if (added.length) onChange([...images, ...added]);
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Product images</span>
        <span className="text-xs text-muted-foreground">
          First image is primary · drag to reorder · {images.length}/{MAX_IMAGES}
        </span>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((src, index) => (
            <div
              key={`${src.slice(0, 48)}-${index}`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={`group relative overflow-hidden rounded-lg border bg-muted/40 ${
                dragIndex === index ? 'opacity-60' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full bg-white object-contain p-1" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-black/55 to-transparent p-1.5">
                <span className="inline-flex items-center gap-0.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">
                  <GripVertical className="h-3 w-3" />
                  {index === 0 ? 'Primary' : `#${index + 1}`}
                </span>
                <div className="flex gap-1">
                  {index !== 0 && (
                    <button
                      type="button"
                      className="rounded bg-black/40 p-1 text-white hover:bg-black/60"
                      title="Make primary"
                      onClick={() => makePrimary(index)}
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded bg-black/40 p-1 text-white hover:bg-destructive"
                    title="Remove"
                    onClick={() => removeAt(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <ImagePlus className="mb-2 h-8 w-8 opacity-50" />
          Add image URLs or upload files (dev stores as data URLs when S3 is unset)
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://… image URL"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={addUrl}>
          Add URL
        </Button>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
