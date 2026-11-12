"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  deleteNotificationData,
  setTopic,
  usePhoneState,
  useSummary,
  UpdatesError,
} from "./notification-client";
import { PhoneAlerts, useEnableAlerts } from "./phone-alerts";

export function NotificationSettings({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const { feed, error } = useSummary();
  const phone = usePhoneState(feed);
  const [pending, setPending] = useState<string | null>(null);
  const [topicError, setTopicError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const removal = useEnableAlerts();
  const topics = [
    ...categories.map((c) => ({
      key: "category:" + c.id,
      label: c.name + " projects",
      follow: { kind: "category" as const, target: c.id },
    })),
    {
      key: "news:all",
      label: "News & Features",
      follow: { kind: "news" as const, target: "all" },
    },
  ];
  // While a change saves, show the requested state; it reverts if saving fails.
  const [requested, setRequested] = useState<{ key: string; on: boolean } | null>(
    null,
  );
  const following = (kind: string, target: string) =>
    requested?.key === kind + ":" + target
      ? requested.on
      : !!feed?.follows.some((f) => f.kind === kind && f.target === target);

  return (
    <div className="container section narrow updates-page">
      <Link className="text-link" href="/updates">
        Back to Updates
      </Link>
      <h1>Notification settings</h1>
      {!feed && error && (
        <p role="alert" className="form-error">
          Settings could not load. Check your internet connection and reload
          this page.
        </p>
      )}
      <section className="detail-section" aria-labelledby="device-alerts">
        <h2 id="device-alerts">Notifications on this device</h2>
        <PhoneAlerts feed={feed} state={phone} />
      </section>
      <section className="detail-section" aria-labelledby="topics-title">
        <h2 id="topics-title">What you’re notified about</h2>
        {feed?.deviceRegistered ? (
          <fieldset className="topic-list" disabled={!!pending}>
            <legend className="sr-only">Notification topics</legend>
            <p className="subtle-note">
              New projects, status changes and important project updates in
              each ticked category, plus news if ticked.
            </p>
            {topics.map((t) => (
              <label key={t.key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={following(t.follow.kind, t.follow.target)}
                  onChange={async (event) => {
                    const on = event.target.checked;
                    setPending(t.key);
                    setRequested({ key: t.key, on });
                    setTopicError("");
                    try {
                      await setTopic(t.follow, on);
                    } catch (e) {
                      setTopicError(
                        e instanceof UpdatesError
                          ? e.message
                          : "Your change could not be saved. Please try again.",
                      );
                    } finally {
                      setPending(null);
                      setRequested(null);
                    }
                  }}
                />
                {t.label}
                {pending === t.key && (
                  <span className="subtle-note"> Saving…</span>
                )}
              </label>
            ))}
            {topicError && (
              <p role="alert" className="form-error">
                {topicError}
              </p>
            )}
          </fieldset>
        ) : (
          <p>
            Turning on notifications includes everything: new projects, project
            updates and news. After that, you can untick topics here.
          </p>
        )}
      </section>
      <section className="detail-section" aria-labelledby="device-only">
        <h2 id="device-only">Settings stay on this device</h2>
        <p>
          There is no account. Notification settings and which updates you have
          read belong to this browser or installed app only. They do not move to
          another phone, and the installed app may keep settings separate from
          your browser. Notification settings are removed after 180 days.
        </p>
      </section>
      <section className="detail-section" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete notification data</h2>
        <p>
          Removes this device’s notification settings, topics and read history
          from the website and stops notifications. Saved favourites are not
          affected.
        </p>
        <Dialog.Root open={confirm} onOpenChange={setConfirm}>
          <Dialog.Trigger asChild>
            <Button variant="outline" onClick={() => setDeleted(false)}>
              Delete notification data
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="install-overlay" />
            <Dialog.Content className="install-dialog">
              <Dialog.Title>Delete notification data?</Dialog.Title>
              <Dialog.Description>
                This device will stop receiving notifications. Its topics and
                read history are deleted from the website and this browser. You
                can turn notifications on again later.
              </Dialog.Description>
              {removal.error && (
                <p role="alert" className="form-error">
                  {removal.error}
                </p>
              )}
              <Button
                disabled={removal.busy}
                onClick={async () => {
                  if (await removal.run(deleteNotificationData)) {
                    setConfirm(false);
                    setDeleted(true);
                  }
                }}
              >
                {removal.busy ? "Deleting…" : "Delete"}
              </Button>
              <Dialog.Close asChild>
                <Button variant="outline" disabled={removal.busy}>
                  Cancel
                </Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <p role="status">
          {deleted ? "Notification data deleted from this device." : ""}
        </p>
      </section>
    </div>
  );
}
