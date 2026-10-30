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
        <span className="eyebrow">INFORMATION FOR EVERYONE</span>
        <h1>
          Our progress belongs
          <br />
          in the open.
        </h1>
        <p>
          A public window into development in Wassa East, available to everyone,
          wherever they are.
        </p>
      </div>
      <div className="values-grid">
        {[
          {
            icon: Eye,
            title: "See the work",
            text: "Explore project locations, progress, milestones, and supporting evidence in one place.",
          },
          {
            icon: ShieldCheck,
            title: "Information with a process",
            text: "Authorised officers submit records. A different approver reviews them before publication.",
          },
          {
            icon: Users,
            title: "Open to every community",
            text: "No membership or public account is required to read project information and evidence.",
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
        <span className="eyebrow">HOW TO READ A PROJECT RECORD</span>
        <h2>A clear record, with context.</h2>
        <p>
          Progress percentages are reported by the constituency team, with an
          explanation of how they were assessed. Milestones are tracked
          separately. A completed project requires a completion date, summary,
          and supporting evidence before independent approval.
        </p>
        <p>
          Dates in the directory refer to approved public updates. While a
          correction is being reviewed, the last approved record stays
          available. Earlier approved versions can be inspected in the
          publication history.
        </p>
        <p>
          Map markers use published coordinates. Projects without reliable
          coordinates remain in the directory. Illustrations are identified and
          are never presented as project evidence.
        </p>
      </section>
    </div>
  );
}
