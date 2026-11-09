"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type HeroPhoto = {
  src: string;
  desktopCrop: string;
  mobileCrop: string;
};

export function HeroPhotos({ photos }: { photos: HeroPhoto[] }) {
  const [active, setActive] = useState(0);
  const [requested, setRequested] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);
  const loaded = useRef(new Set<number>());
  const available = photos.map((_, i) => i).filter((i) => !failed.includes(i));
  const multiple = available.length > 1;
  const next = available[(available.indexOf(requested) + 1) % available.length];
  const previous =
    available[
      (available.indexOf(requested) - 1 + available.length) % available.length
    ];

  function select(index: number) {
    setRequested(index);
    if (loaded.current.has(index)) setActive(index);
  }

  useEffect(() => {
    if (!multiple) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPlaying(!motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, [multiple]);

  useEffect(() => {
    if (!multiple || !playing || active !== requested) return;
    const timer = window.setTimeout(() => select(next), 4000);
    return () => window.clearTimeout(timer);
  }, [active, requested, multiple, playing, next]);

  return (
    <>
      {photos.map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt=""
          fill
          sizes="100vw"
          preload={i === 0}
          loading={i === 0 ? undefined : "lazy"}
          className="register-hero-image"
          data-visible={active === i}
          style={
            {
              "--hero-crop": photo.desktopCrop,
              "--hero-mobile-crop": photo.mobileCrop,
            } as CSSProperties
          }
          onLoad={() => {
            loaded.current.add(i);
            if (requested === i) setActive(i);
          }}
          onError={() => {
            setFailed((current) => [...current, i]);
            if (requested === i) {
              const fallback = available.find((index) => index !== i);
              if (fallback !== undefined) select(fallback);
            }
          }}
        />
      ))}
      {multiple && (
        <div
          className="hero-photo-controls"
          role="group"
          aria-label="Hero photos"
        >
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => select(previous)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            onClick={() => {
              if (playing) select(active);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => select(next)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </>
  );
}
