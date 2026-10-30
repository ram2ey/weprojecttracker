"use client";
import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences, changePreferences } from "./device-store";
export function FollowButton({
  recordId,
  revisionId,
}: {
  recordId: string;
  revisionId: string;
}) {
  const p = usePreferences(),
    [error, setError] = useState("");
  const follows = p.follows.includes(recordId);
  useEffect(() => {
    if (follows)
      try {
        changePreferences((p) => ({
          ...p,
          read: { ...p.read, [recordId]: revisionId },
        }));
      } catch {}
  }, [recordId, revisionId, follows]);
  return (
    <div className="follow-control">
      <Button
        variant="outline"
        aria-pressed={follows}
        onClick={() => {
          try {
            changePreferences((p) => ({
              ...p,
              follows: follows
                ? p.follows.filter((id) => id !== recordId)
                : [...p.follows, recordId],
              read: { ...p.read, [recordId]: revisionId },
            }));
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Bookmark size={16} />
        {follows ? "Following on this device" : "Follow this project"}
      </Button>
      <small>
        Follows and read status stay in this browser.{" "}
        <a href="/following">Your following feed</a>
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
