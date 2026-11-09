import Link from "next/link";
import Image from "next/image";
import { MpProfile } from "@/components/mp-profile";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "About Wassa East",
  "Learn about Wassa East, its constituency leadership, and how project updates are reviewed.",
  "/about",
);
export default function About() {
  return (
    <div className="container section about-page">
      <h1>About Wassa East</h1>
      <div className="about-reading">
        <p>
          Daboase is the district capital of Wassa East in Ghana’s Western
          Region. The district’s four area councils serve Daboase, Ekutuasie,
          Ateiku and Enyinabrem.
        </p>
        <p>
          Farming is part of everyday life here. Communities produce cocoa,
          coffee and oil palm alongside food crops.
        </p>
        <a
          className="text-link"
          href="https://wrcc.gov.gh/wassa-east-district-assembly/"
        >
          Read the Western Regional Co-ordinating Council’s district profile
        </a>
      </div>
      <section
        className="detail-section leadership"
        aria-labelledby="leadership-title"
      >
        <h2 id="leadership-title">MP and Constituency Executives</h2>
        <MpProfile />
        <h3>Constituency executives</h3>
        <ul className="executive-list">
          {[1, 2].map((entry) => (
            <li key={entry}>
              <Image
                className="leadership-portrait"
                src="/illustrations/leadership-portrait.svg"
                alt="Executive portrait placeholder"
                width={80}
                height={96}
              />
              <div>
                <strong>Executive name pending</strong>
                <span>Office to be confirmed</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="detail-section about-reading">
        <h2>How project updates are reviewed</h2>
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
        <div className="action-row">
          <Link className="text-link" href="/projects">
            Explore projects
          </Link>
          <Link className="text-link" href="/contact">
            Contact the office
          </Link>
        </div>
      </section>
    </div>
  );
}
