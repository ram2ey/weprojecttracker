import Link from "next/link";
import { officePhone } from "@/lib/office-contact";

const trackerQuestions = [
  [
    "How do I find projects in my community?",
    "Open Projects and choose your community from the filter. You can also type the community name in the search box.",
  ],
  [
    "Can I see only ongoing or completed projects?",
    "Yes. Choose Ongoing or Completed in the status filter. Add a community to narrow the results to your area.",
  ],
  [
    "Who reviews project updates?",
    "A staff member prepares the update and a separate approver reviews it. The last approved version stays visible while the review is underway.",
  ],
  [
    "What does “Completed” mean?",
    "The office requires a completion date, a summary of the work, and a photograph before a project can be published as completed.",
  ],
  [
    "How can I tell how recent the information is?",
    "Open the project and look for Last approved update. The Information source section tells you where the details came from.",
  ],
];

const contactQuestions = [
  [
    "How can I reach the constituency office?",
    `Call ${officePhone} or use the WhatsApp button on the Contact Us page.`,
  ],
  [
    "What should I include when asking about a project?",
    "Include the project name, its community, and your question. If you have the project page open, copy its link into your message.",
  ],
  [
    "How do I suggest a correction?",
    "Tell the office which detail appears incorrect and what you think it should say. A date or public source can help staff check it.",
  ],
  [
    "What if I can’t find a project in the tracker?",
    "Contact the office with the community, a nearby landmark, and a short description of the work. You can ask even if you don’t know the project’s official name.",
  ],
  [
    "Do I need to send identification?",
    "For a general project enquiry, the project details are enough. Please leave out identity documents, passwords, and sensitive personal information.",
  ],
];

export function FaqSection({
  topic,
  fullPage = false,
}: {
  topic: "tracker" | "contact";
  fullPage?: boolean;
}) {
  const id = fullPage ? topic : "faq";
  const title =
    topic === "tracker" ? "Using the tracker" : "Contacting the office";
  const questions = topic === "tracker" ? trackerQuestions : contactQuestions;
  return (
    <section
      id={id}
      className="container narrow section home-faq"
      aria-labelledby={id + "-title"}
    >
      <h2 id={id + "-title"}>
        {fullPage ? title : "Frequently asked questions"}
      </h2>
      {questions.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
      {!fullPage && (
        <Link className="text-link" href={"/faq#" + topic}>
          View all questions
        </Link>
      )}
    </section>
  );
}
