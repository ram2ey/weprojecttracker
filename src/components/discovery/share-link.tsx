"use client";
import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ShareLink({ title, url }: { title: string; url: string }) {
  const [message, setMessage] = useState(""),
    [fallback, setFallback] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setMessage("Share options opened.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFallback(true);
      setMessage("Copy the link below to share this record.");
    }
  }
  return (
    <div className="share-control">
      <Button variant="outline" onClick={share}>
        {message === "Link copied." ? (
          <Check size={16} />
        ) : (
          <Share2 size={16} />
        )}
        Share this record
      </Button>
      {message && <p role="status">{message}</p>}
      {fallback && (
        <label>
          Public link
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </div>
  );
}
