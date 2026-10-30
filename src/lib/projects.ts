import { isDesignPreview } from "./env";
export type ProjectStatus =
  "Ongoing" | "Completed" | "Planned" | "Delayed" | "Suspended" | "Cancelled";
export type PublicProject = {
  id: string;
  slug: string;
  title: string;
  category: string;
  community: string;
  status: ProjectStatus;
  progress: number;
  description: string;
  image: "school" | "clinic" | "water";
  updated: string;
  coverUrl?: string;
};
const examples: PublicProject[] = [
  {
    id: "WE-EDU-001",
    slug: "classroom-block",
    title: "A better place to learn",
    category: "Education",
    community: "Daboase",
    status: "Ongoing",
    progress: 64,
    description:
      "A six-classroom block designed to give young learners a brighter, more comfortable place to grow. The current stage covers roofing and internal finishes.",
    image: "school",
    updated: "23 October 2026",
  },
  {
    id: "WE-HEA-002",
    slug: "health-centre",
    title: "Care closer to the community",
    category: "Health",
    community: "Ateiku",
    status: "Completed",
    progress: 100,
    description:
      "Renovation of a community health facility, including improved consultation rooms and essential facilities for patients and staff.",
    image: "clinic",
    updated: "21 October 2026",
  },
  {
    id: "WE-SOC-003",
    slug: "community-water",
    title: "Reliable water, every day",
    category: "Social Amenities",
    community: "Sekyere Krobo",
    status: "Ongoing",
    progress: 35,
    description:
      "A community water access initiative, with a mechanised borehole, storage tank, and accessible public collection point.",
    image: "water",
    updated: "19 October 2026",
  },
  {
    id: "WE-COM-004",
    slug: "community-market",
    title: "Space for local enterprise",
    category: "Community Development",
    community: "Daboase",
    status: "Planned",
    progress: 0,
    description:
      "Proposed improvements to community trading spaces, with safer walkways and sheltered stalls.",
    image: "school",
    updated: "16 October 2026",
  },
  {
    id: "WE-GEN-005",
    slug: "youth-skills",
    title: "Building practical skills",
    category: "General",
    community: "Ateiku",
    status: "Delayed",
    progress: 20,
    description:
      "A practical skills initiative for young people. The next reporting cycle will explain the revised delivery schedule.",
    image: "clinic",
    updated: "12 October 2026",
  },
  {
    id: "WE-SOC-006",
    slug: "street-lighting",
    title: "Safer journeys after dark",
    category: "Social Amenities",
    community: "Sekyere Krobo",
    status: "Suspended",
    progress: 10,
    description:
      "An illustrative street lighting initiative awaiting a reviewed implementation schedule.",
    image: "water",
    updated: "10 October 2026",
  },
];
export const categories = [
  "Education",
  "Health",
  "Community Development",
  "Social Amenities",
  "General",
];
export const statuses: ProjectStatus[] = [
  "Ongoing",
  "Completed",
  "Planned",
  "Delayed",
  "Suspended",
  "Cancelled",
];
export function publicProjects() {
  return isDesignPreview() ? examples : [];
}
export function statusTone(status: string) {
  return (
    (
      {
        Ongoing: "green",
        Completed: "blue",
        Planned: "neutral",
        Delayed: "amber",
        Suspended: "amber",
        Cancelled: "red",
      } as Record<string, string>
    )[status] ?? "neutral"
  );
}
