"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Landmark,
  LayoutDashboard,
  FolderOpen,
  ClipboardCheck,
  Users,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Bell,
  Search,
  LogOut,
  ChevronRight,
  Clock3,
  CircleCheck,
  ArrowLeft,
  Upload,
  MapPin,
  FileText,
  Settings2,
  History,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type PublicProject, statusTone, categories } from "@/lib/projects";
import type { Role } from "@/lib/security/policy";
import { TeamForm } from "./team-form";
export function Console({
  preview,
  view,
  projects,
  name,
  role,
  children,
}: {
  preview: boolean;
  view: string;
  projects: PublicProject[];
  name: string;
  role: Role;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const base = preview ? "/preview/console" : "/admin";
  const nav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "projects", label: "Projects", icon: FolderOpen },
    { key: "review", label: "Review queue", icon: ClipboardCheck },
    ...(!preview
      ? [
          {
            key: "engagement",
            label: "Comments & feedback",
            icon: MessageSquare,
          },
          { key: "inbox", label: "Your inbox", icon: Bell },
          { key: "reports", label: "Reports & exports", icon: BarChart3 },
        ]
      : []),
    ...(role === "super_admin"
      ? [
          { key: "team", label: "Staff access", icon: Users },
          ...(!preview
            ? [
                {
                  key: "taxonomy",
                  label: "Categories & places",
                  icon: Settings2,
                },
                { key: "audit", label: "Audit trail", icon: History },
              ]
            : []),
        ]
      : []),
  ];
  async function signOut() {
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/staff/login");
      router.refresh();
    } catch {
      setSignOutError(
        "Unable to sign out. Connect to the internet and try again.",
      );
    }
  }
  return (
    <div className="console-shell">
      <aside
        className="console-sidebar"
        aria-label="Staff workspace navigation"
      >
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Landmark size={21} />
          </span>
          <span>
            Wassa East<span className="brand-subtitle">STAFF WORKSPACE</span>
          </span>
        </Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Staff navigation">
          {nav.map(({ key, label, icon: Icon }) => (
            <Link
              className={view === key ? "active" : ""}
              key={key}
              href={`${base}?view=${key}`}
            >
              <Icon size={18} />
              {label}
              {preview && key === "review" && (
                <span className="nav-count">3</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldIcon />
          <strong>Independent approval</strong>
          <p>Another staff member must approve publication.</p>
        </div>
        <div className="sidebar-bottom">
          <Link href="/">
            View public website <ArrowUpRight size={15} />
          </Link>
          <div className="staff-profile">
            <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>{role.replace("_", " ")}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="console-body">
        <header className="console-topbar">
          <span>
            Workspace <ChevronRight size={14} />{" "}
            {view === "new"
              ? "New project"
              : (nav.find((n) => n.key === view)?.label ?? "Overview")}
          </span>
          <div>
            {preview ? (
              <Link href="/" className="preview-chip">
                DESIGN PREVIEW <ArrowUpRight size={14} />
              </Link>
            ) : (
              <span className="preview-chip">MFA VERIFIED</span>
            )}
            {!preview && (
              <Link
                className="notification-icon"
                href="/admin?view=inbox"
                aria-label="Your notification inbox"
              >
                <Bell size={18} />
              </Link>
            )}
            {!preview && (
              <button
                className="staff-sign-out"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" className="console-main" tabIndex={-1}>
          {signOutError && (
            <p role="alert" className="form-error">
              {signOutError}
            </p>
          )}
          {children ?? (
            <>
              {preview && (
                <p className="console-preview-note">
                  Design review only. Sample submissions are not live records.
                  No changes are saved.
                </p>
              )}
              {view === "new" ? (
                <>
                  <Link href={base} className="text-link">
                    <ArrowLeft size={15} /> Back to workspace
                  </Link>
                  <div className="console-heading">
                    <div>
                      <h1>New project</h1>
                      <p>Save a draft, then submit it for review.</p>
                    </div>
                    <Badge>Draft</Badge>
                  </div>
                  <form
                    className="project-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setMessage(
                        "Design preview only. Project saving and submission will be connected in Phase 2.",
                      );
                    }}
                  >
                    <section className="form-section">
                      <div className="form-section-heading">
                        <span>01</span>
                        <div>
                          <h2>Details</h2>
                        </div>
                      </div>
                      <div className="form-stack">
                        <label>
                          Project title
                          <input
                            required
                            placeholder="e.g. Six-classroom block at a community school"
                          />
                        </label>
                        <div className="form-columns">
                          <label>
                            Category
                            <select required aria-label="Category">
                              <option value="">Choose a category</option>
                              {categories.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Community
                            <input required placeholder="Community name" />
                          </label>
                        </div>
                        <label>
                          Description and objectives
                          <textarea
                            rows={4}
                            required
                            placeholder="What is being done, and who will it benefit?"
                          />
                        </label>
                      </div>
                    </section>
                    <section className="form-section">
                      <div className="form-section-heading">
                        <span>02</span>
                        <div>
                          <h2>Location and progress</h2>
                          <p>
                            Explain where the work is and its current stage.
                          </p>
                        </div>
                      </div>
                      <div className="form-columns">
                        <label>
                          Start date
                          <input type="date" />
                        </label>
                        <label>
                          Expected completion
                          <input type="date" />
                        </label>
                        <label>
                          Status
                          <select>
                            <option>Planned</option>
                            <option>Ongoing</option>
                            <option>Completed</option>
                            <option>Delayed</option>
                          </select>
                        </label>
                        <label>
                          Progress (%)
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={0}
                          />
                        </label>
                      </div>
                      <label className="top-space block-label">
                        How is progress measured?
                        <textarea
                          rows={3}
                          placeholder="Explain the evidence behind this percentage."
                        />
                      </label>
                    </section>
                    <section className="form-section">
                      <div className="form-section-heading">
                        <span>03</span>
                        <div>
                          <h2>Supporting evidence</h2>
                          <p>
                            Photographs and documents give context to the work.
                          </p>
                        </div>
                      </div>
                      <div className="upload-placeholder">
                        <Upload size={25} />
                        <strong>Media upload design</strong>
                        <span>
                          Images and PDF upload will be connected in Phase 2.
                        </span>
                      </div>
                    </section>
                    <div className="form-actions">
                      <p>
                        <Clock3 size={16} />
                        Drafts stay private until approved.
                      </p>
                      <Button type="submit" variant="outline">
                        Preview save draft
                      </Button>
                      <Button type="submit">
                        Preview send for review <ArrowRight size={16} />
                      </Button>
                    </div>
                  </form>
                </>
              ) : view === "team" ? (
                <>
                  <div className="console-heading">
                    <div>
                      <h1>Staff</h1>
                      <p>Share setup and recovery links privately.</p>
                    </div>
                  </div>
                  {role === "super_admin" && <TeamForm preview={preview} />}
                </>
              ) : (
                <>
                  <div className="console-heading">
                    <div>
                      <h1>
                        {view === "review"
                          ? "Independent approval"
                          : view === "projects"
                            ? "Projects"
                            : "Overview"}
                      </h1>
                    </div>
                    {(preview || role !== "approver") && (
                      <Button asChild>
                        <Link href={`${base}?view=new`}>
                          <Plus size={17} /> New project
                        </Link>
                      </Button>
                    )}
                  </div>
                  <div className="console-stats">
                    {[
                      {
                        label: "Total projects",
                        count: projects.length,
                        icon: FolderOpen,
                        foot: "Across all communities",
                      },
                      {
                        label: "Awaiting review",
                        count: preview ? 3 : 0,
                        icon: ClipboardCheck,
                        foot: "Ready for a second pair of eyes",
                      },
                      {
                        label: "Needs an update",
                        count: preview ? 1 : 0,
                        icon: Clock3,
                        foot: "Past the reporting interval",
                      },
                      {
                        label: "Completed",
                        count: projects.filter((p) => p.status === "Completed")
                          .length,
                        icon: CircleCheck,
                        foot: "Published completion records",
                      },
                    ].map(({ label, count, icon: Icon, foot }) => (
                      <article key={label}>
                        <span>
                          {label}
                          <Icon size={17} />
                        </span>
                        <strong>{String(count).padStart(2, "0")}</strong>
                        <small>{foot}</small>
                      </article>
                    ))}
                  </div>
                  <div className="console-grid">
                    <section className="table-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {view === "review"
                              ? "Submissions to review"
                              : "Project activity"}
                          </h2>
                          <p>
                            {preview
                              ? "Latest records from your constituency team"
                              : "No live records have been entered"}
                          </p>
                        </div>
                        <Search size={18} />
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Project</th>
                              <th>Status</th>
                              <th>Progress</th>
                              <th>Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projects.slice(0, 5).map((p) => (
                              <tr key={p.id}>
                                <td>
                                  <Link href={`/projects/${p.slug}`}>
                                    {p.title}
                                  </Link>
                                  <small>
                                    <MapPin size={11} />
                                    {p.community} · {p.id}
                                  </small>
                                </td>
                                <td>
                                  <Badge tone={statusTone(p.status)}>
                                    {p.status}
                                  </Badge>
                                </td>
                                <td>
                                  <div className="table-progress">
                                    <div className="progress-track">
                                      <div
                                        style={{ width: `${p.progress}%` }}
                                      />
                                    </div>
                                    {p.progress}%
                                  </div>
                                </td>
                                <td>{p.updated.replace(" 2026", "")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!projects.length && (
                        <div className="empty-state">
                          <FolderOpen size={32} />
                          <h3>Your workspace is ready.</h3>
                          <p>
                            Project entry, approval, and publication are the
                            next implementation phase.
                          </p>
                        </div>
                      )}
                    </section>
                    <aside
                      className="review-panel"
                      aria-label="Publication review guidance"
                    >
                      <span className="eyebrow">THE REVIEW DESK</span>
                      <h2>{preview ? "Review queue" : "Publication review"}</h2>
                      <p>
                        Check the facts, review the evidence, and keep a record
                        of every decision.
                      </p>
                      {preview && (
                        <div className="review-item">
                          <span className="document-icon">
                            <FileText size={20} />
                          </span>
                          <div>
                            <strong>Classroom block update</strong>
                            <small>Sample submission · 2 days ago</small>
                          </div>
                        </div>
                      )}
                      <ol>
                        <li>Confirm the information is complete.</li>
                        <li>Check photographs and references.</li>
                        <li>Approve, return, or reject with a reason.</li>
                      </ol>
                      <Link href={`${base}?view=review`} className="text-link">
                        Open review queue <ArrowRight size={16} />
                      </Link>
                    </aside>
                  </div>
                </>
              )}
              {message && (
                <p className="notice" role="status">
                  {message}
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function ShieldIcon() {
  return <ClipboardCheck size={23} strokeWidth={1.5} />;
}
