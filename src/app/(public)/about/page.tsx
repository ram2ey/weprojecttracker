import { Eye, Users, ShieldCheck } from "lucide-react";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "About the platform",
  "How project information, progress and evidence are reviewed and published for Wassa East.",
  "/about",
);
export default function AboutPage() {
  return (
    <div className="container section">
      <div className="page-heading">
        <h1>About</h1>
        <p>Project information for Wassa East. No account needed.</p>
      </div>
      <div className="values-grid">
        {[
          {
            icon: Eye,
            title: "Project records",
            text: "View locations, progress, milestones and evidence.",
          },
          {
            icon: ShieldCheck,
            title: "Independent review",
            text: "A different staff member approves each record before publication.",
          },
          {
            icon: Users,
            title: "Public access",
            text: "Everyone can browse published records.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={28} strokeWidth={1.5} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <section className="contact-panel">
        <h2>Understanding the records</h2>
        <p>
          Progress is reported by the constituency team. Completed projects
          require a completion date, summary, evidence and independent approval.
        </p>
        <p>
          Directory dates refer to approved updates. The last approved version
          stays public during review. Earlier versions appear in publication
          history.
        </p>
        <p>
          Projects without coordinates remain in the directory. Illustrations
          are labelled and are not project evidence.
        </p>
      </section>
    </div>
  );
}
