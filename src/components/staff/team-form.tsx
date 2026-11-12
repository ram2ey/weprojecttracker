"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
import { roleLabel } from "@/lib/security/policy";
type Person = {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};
export function TeamForm() {
  const [people, setPeople] = useState<Person[]>([]),
    [secret, setSecret] = useState<{
      username: string;
      password: string;
      expiresAt: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setPeople(await contentRequest<Person[]>("/api/staff/accounts", "GET"));
  }
  useEffect(() => {
    let live = true;
    void contentRequest<Person[]>("/api/staff/accounts", "GET")
      .then((data) => {
        if (live) setPeople(data);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, []);
  async function action(body: object, username: string) {
    setBusy(true);
    setError("");
    setSecret(null);
    try {
      const r = await contentRequest<{
        temporaryPassword?: string;
        temporaryPasswordExpiresAt?: string;
      }>("/api/staff/accounts", "POST", body);
      if (r.temporaryPassword)
        setSecret({
          username,
          password: r.temporaryPassword,
          expiresAt: r.temporaryPasswordExpiresAt!,
        });
      await load();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      username = String(f.get("username")).trim().toLowerCase();
    if (
      await action(
        {
          action: "create",
          username,
          name: f.get("name"),
        },
        username,
      )
    )
      form.reset();
  }
  return (
    <>
      <h1>Staff</h1>
      <p>
        Create individual accounts. Every account is an Admin: it can create,
        approve and publish projects and news, and manage staff, comments,
        communities and statistics. Share temporary passwords privately; staff
        must change them within 24 hours before accessing projects. Another
        admin can reset an expired password.
      </p>
      <form className="form-section form-stack" onSubmit={create}>
        <h2>Add staff member</h2>
        <div className="form-columns">
          <label>
            Name
            <input name="name" minLength={2} maxLength={100} required />
          </label>
          <label>
            Username
            <input
              name="username"
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="off"
              required
            />
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          Create account
        </Button>
      </form>
      {secret && (
        <section className="notice" role="status">
          <h2>Temporary password — shown once</h2>
          <p>Username: {secret.username}</p>
          <p>
            Expires:{" "}
            <time dateTime={secret.expiresAt}>
              {new Date(secret.expiresAt).toLocaleString()}
            </time>
            . Share privately; this password is shown once.
          </p>
          <label>
            Temporary password
            <input
              readOnly
              value={secret.password}
              onFocus={(e) => e.target.select()}
              autoComplete="off"
            />
          </label>
          <Button variant="outline" onClick={() => setSecret(null)}>
            Dismiss password
          </Button>
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="staff-list">
        {people.map((p) => (
          <article className="form-section" key={p.id}>
            <h2>{p.name}</h2>
            <p>
              {p.username} · {roleLabel} · {p.active ? "Active" : "Inactive"}
              {p.mustChangePassword ? " · Password change required" : ""}
            </p>
            <div className="action-row">
              {(
                [
                  "reset",
                  "revoke",
                  p.active ? "deactivate" : "reactivate",
                ] as const
              ).map((a) => (
                <Button
                  key={a}
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      a === "reset" &&
                      !window.confirm(
                        "Reset the password for " +
                          p.username +
                          " and sign out their sessions?",
                      )
                    )
                      return;
                    if (
                      a === "deactivate" &&
                      !window.confirm(
                        "Deactivate " + p.username + " and revoke access?",
                      )
                    )
                      return;
                    void action({ action: a, id: p.id }, p.username);
                  }}
                >
                  {a === "reset"
                    ? "Reset password"
                    : a === "revoke"
                      ? "Revoke sessions"
                      : a === "deactivate"
                        ? "Deactivate"
                        : "Reactivate"}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
