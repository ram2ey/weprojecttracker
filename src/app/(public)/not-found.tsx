import { NotFoundMessage } from "@/components/not-found-message";

export default function PublicNotFound() {
  return (
    <div className="container empty-state">
      <NotFoundMessage />
    </div>
  );
}
