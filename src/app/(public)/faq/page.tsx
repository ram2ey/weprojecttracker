import { FaqSection } from "@/components/faq-section";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata(
  "Frequently asked questions",
  "Answers about using the project tracker and contacting the constituency office.",
  "/faq",
);

export default function FaqPage() {
  return (
    <div className="full-faq">
      <h1 className="container narrow">Frequently asked questions</h1>
      <FaqSection topic="tracker" fullPage />
      <FaqSection topic="contact" fullPage />
    </div>
  );
}
