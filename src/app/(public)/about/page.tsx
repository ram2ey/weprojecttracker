import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "About",
  "How Wassa East project information is reviewed and published.",
  "/about",
);
export default function About() {
  return (
    <div className="container section narrow">
      <h1>About the register</h1>
      <section className="detail-section">
        <h2>Project information for Wassa East</h2>
        <p>
          Browse projects, their current status and published photographs. No
          public account is needed.
        </p>
      </section>
      <section className="detail-section">
        <h2>Independently reviewed</h2>
        <p>
          Staff prepare project records. A separate approver reviews each
          publication and update. The previous approved version remains public
          while changes are reviewed.
        </p>
        <p>
          Completed projects require a completion date, summary and photograph.
          Each record identifies its information source and latest approved
          update.
        </p>
      </section>
    </div>
  );
}
