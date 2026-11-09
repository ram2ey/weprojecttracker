export type Story = {
  kind: "News" | "Feature";
  title: string;
  summary: string;
  detail: string;
  project: string;
  photo: string;
  caption: string;
};
export const blankStory: Story = {
  kind: "News",
  title: "",
  summary: "",
  detail: "",
  project: "",
  photo: "",
  caption: "",
};
