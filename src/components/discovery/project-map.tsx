"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StyleSpecification } from "maplibre-gl";
import type { ProjectMapData } from "@/lib/content/discovery";
const MapCanvas = dynamic(
  () => import("./map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <p className="map-state" role="status">
        Preparing the interactive map…
      </p>
    ),
  },
);
export function ProjectMap({
  query,
  sample = false,
}: {
  query: string;
  sample?: boolean;
}) {
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "unavailable" | "error"
  >("idle");
  const [data, setData] = useState<ProjectMapData | null>(null),
    [style, setStyle] = useState<StyleSpecification | null>(null);
  async function load() {
    setState("loading");
    try {
      const [configResponse, dataResponse] = await Promise.all([
        fetch("/api/public/map-config", { cache: "no-store" }),
        fetch(`/api/public/projects/map?${query}`, { cache: "no-store" }),
      ]);
      if (!configResponse.ok || !dataResponse.ok)
        throw new Error("Map unavailable");
      const config = (await configResponse.json()) as {
          configured: boolean;
          style?: StyleSpecification;
        },
        result = (await dataResponse.json()) as ProjectMapData;
      setData(result);
      if (!config.configured || !config.style) {
        setState("unavailable");
        return;
      }
      setStyle(config.style);
      setState("ready");
    } catch {
      setState("error");
    }
  }
  return (
    <section className="project-map-panel" aria-labelledby="project-map-title">
      <div className="map-panel-heading">
        <div>
          <span className="eyebrow">PROJECTS BY LOCATION</span>
          <h2 id="project-map-title">A closer look at your community.</h2>
        </div>
        <MapPin size={28} strokeWidth={1.5} />
      </div>
      {sample ? (
        <p className="map-state">
          Sample projects have no verified coordinates. Their locations are not
          plotted. Browse the design examples below.
        </p>
      ) : (
        <>
          {state === "idle" && (
            <div className="map-state">
              <p>
                Load the map to explore approved project locations. Map tiles
                are provided by Geoapify and OpenStreetMap; loading connects
                your browser to Geoapify.
              </p>
              <Button onClick={load}>
                <MapPin size={16} />
                Load interactive map
              </Button>
            </div>
          )}
          {state === "loading" && (
            <p className="map-state" role="status">
              Loading approved project locations…
            </p>
          )}
          {state === "unavailable" && (
            <p className="map-state" role="status">
              The interactive map is not available yet. You can explore every
              matching project in the list below.
            </p>
          )}
          {state === "error" && (
            <div className="map-state" role="status">
              <p>
                The map could not be loaded. Your project results are still
                available below.
              </p>
              <Button variant="outline" onClick={load}>
                Try loading the map again
              </Button>
            </div>
          )}
          {data && (
            <p className="map-coverage">
              {data.located} of {data.total} matching projects have published
              coordinates. {data.total - data.located} remain available in the
              directory without a map marker.
              {data.truncated &&
                " Showing up to 1,000 markers; narrow your filters to see more."}
            </p>
          )}
          {state === "ready" &&
            data &&
            style &&
            (data.shown ? (
              <MapCanvas data={data} style={style} />
            ) : (
              <p className="map-state">
                No matching projects have published coordinates yet. No project
                locations have been estimated.
              </p>
            ))}
        </>
      )}
    </section>
  );
}
