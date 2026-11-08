import { FavouriteProjects } from "@/components/content/favourite-projects";
import { pageMetadata } from "@/lib/site";

export const metadata = {
  ...pageMetadata(
    "Favourites",
    "Projects saved in this browser.",
    "/favourites",
  ),
  robots: { index: false, follow: true },
};
export default function FavouritesPage() {
  return (
    <div className="container section directory">
      <h1>Favourites</h1>
      <p>
        Your favourites are saved in this browser. Clearing site data clears
        your list.
      </p>
      <FavouriteProjects />
    </div>
  );
}
