"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
type Photo = { id: string; caption: string; capturedOn: string };
export function EvidenceGallery({ photos }: { photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  if (!photo) return null;
  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
  }
  function move(direction: number) {
    setIndex((i) => (i + direction + photos.length) % photos.length);
  }
  return (
    <>
      <div className="photo-gallery">
        {photos.map((p, i) => (
          <figure key={p.id}>
            <button
              className="gallery-thumb"
              onClick={() => open(i)}
              aria-label={`Enlarge photograph ${i + 1}: ${p.caption || "Approved project evidence"}`}
            >
              <Image
                src={`/api/public/thumbnails/${p.id}`}
                alt={p.caption || "Approved project evidence"}
                width={640}
                height={480}
                unoptimized
                sizes="(max-width: 650px) 100vw, 340px"
              />
              <span>
                <Expand size={17} />
                View photograph
              </span>
            </button>
            <figcaption>
              {p.caption}
              {p.capturedOn && ` · ${p.capturedOn}`}
            </figcaption>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-labelledby="gallery-caption"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
      >
        <div className="gallery-dialog-toolbar">
          <span>
            Photograph {index + 1} of {photos.length}
          </span>
          <Button
            variant="outline"
            onClick={() => dialog.current?.close()}
            aria-label="Close photograph"
          >
            <X size={20} />
          </Button>
        </div>
        <Image
          src={`/api/media/${photo.id}`}
          alt={photo.caption || "Approved project evidence"}
          width={1600}
          height={1000}
          unoptimized
        />
        <p id="gallery-caption">
          {photo.caption || "Approved project evidence"}
          {photo.capturedOn && ` · ${photo.capturedOn}`}
        </p>
        {photos.length > 1 && (
          <div className="action-row">
            <Button variant="outline" onClick={() => move(-1)}>
              <ChevronLeft size={16} />
              Previous photograph
            </Button>
            <Button variant="outline" onClick={() => move(1)}>
              Next photograph
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
        <a
          href={`/api/media/${photo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Open full photograph ↗
        </a>
      </dialog>
    </>
  );
}
