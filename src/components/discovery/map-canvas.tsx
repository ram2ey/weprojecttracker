"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Map as LibreMap,
  Marker,
  NavigationControl,
  AttributionControl,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ProjectMapData, MapProperties } from "@/lib/content/discovery";
setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);
export function MapCanvas({
  data,
  style,
}: {
  data: ProjectMapData;
  style: StyleSpecification;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null);
  const [selected, setSelected] = useState<MapProperties | null>(null),
    [failure, setFailure] = useState("");
  useEffect(() => {
    if (!container.current || !data.geojson.features.length) return;
    let current: LibreMap;
    let disposed = false;
    const clusterLabels = new Map<number, Marker>();
    try {
      current = new LibreMap({
        container: container.current,
        style,
        center: data.geojson.features[0].geometry.coordinates as [
          number,
          number,
        ],
        zoom: 10,
        attributionControl: false,
        cooperativeGestures: true,
        renderWorldCopies: false,
      });
      map.current = current;
      current.addControl(
        new NavigationControl({ showCompass: false }),
        "top-right",
      );
      current.addControl(
        new AttributionControl({ compact: false }),
        "bottom-right",
      );
      current.on("error", () =>
        setFailure(
          "The base map could not be fully loaded. Use the project list below if map details are unavailable.",
        ),
      );
      current.on("load", () => {
        current.addSource("projects", {
          type: "geojson",
          data: data.geojson,
          cluster: true,
          clusterRadius: 45,
          clusterMaxZoom: 14,
        });
        current.addLayer({
          id: "clusters",
          type: "circle",
          source: "projects",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#1b6042",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              22,
              10,
              28,
              50,
              35,
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        // DOM labels avoid a remote font/glyph dependency and allow keyboard zoom.
        current.addLayer({
          id: "points",
          type: "circle",
          source: "projects",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#b53e35",
            "circle-radius": 9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        current.on("render", () => {
          if (!current.isSourceLoaded("projects")) return;
          const visible = new Set<number>();
          for (const feature of current.querySourceFeatures("projects")) {
            if (
              !feature.properties.cluster ||
              feature.geometry.type !== "Point"
            )
              continue;
            const id = Number(feature.properties.cluster_id);
            visible.add(id);
            if (clusterLabels.has(id)) continue;
            const label = document.createElement("button");
            label.className = "cluster-count";
            label.textContent = String(feature.properties.point_count);
            label.setAttribute(
              "aria-label",
              `${feature.properties.point_count} projects; zoom into this group`,
            );
            const coords = feature.geometry.coordinates as [number, number];
            label.addEventListener("click", async () => {
              try {
                const zoom = await (
                  current.getSource("projects") as GeoJSONSource
                ).getClusterExpansionZoom(id);
                current.easeTo({
                  center: coords,
                  zoom,
                  duration: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? 0
                    : 400,
                });
              } catch {
                setFailure("Select a project using the location list.");
              }
            });
            clusterLabels.set(
              id,
              new Marker({ element: label }).setLngLat(coords).addTo(current),
            );
          }
          for (const [id, label] of clusterLabels)
            if (!visible.has(id)) {
              label.remove();
              clusterLabels.delete(id);
            }
        });
        current.on("click", "clusters", async (e) => {
          const f = current.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
          })[0];
          if (f?.geometry.type !== "Point") return;
          try {
            const zoom = await (
              current.getSource("projects") as GeoJSONSource
            ).getClusterExpansionZoom(Number(f.properties.cluster_id));
            current.easeTo({
              center: f.geometry.coordinates as [number, number],
              zoom,
              duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : 400,
            });
          } catch {
            setFailure(
              "This cluster changed. Select a project using the location list.",
            );
          }
        });
        current.on("click", "points", (e) => {
          const f = e.features?.[0];
          if (f) setSelected(f.properties as MapProperties);
        });
        for (const layer of ["clusters", "points"]) {
          current.on("mouseenter", layer, () => {
            current.getCanvas().style.cursor = "pointer";
          });
          current.on("mouseleave", layer, () => {
            current.getCanvas().style.cursor = "";
          });
        }
        const bounds = new LngLatBounds();
        for (const f of data.geojson.features)
          bounds.extend(f.geometry.coordinates as [number, number]);
        current.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 });
      });
    } catch {
      queueMicrotask(() => {
        if (!disposed)
          setFailure(
            "Your browser cannot display the interactive map. Every matching project is available in the directory below.",
          );
      });
    }
    return () => {
      disposed = true;
      map.current = null;
      for (const label of clusterLabels.values()) label.remove();
      current?.remove();
    };
  }, [data, style]);
  function choose(slug: string) {
    const f = data.geojson.features.find((f) => f.properties.slug === slug);
    setSelected(f?.properties ?? null);
    if (f)
      map.current?.easeTo({
        center: f.geometry.coordinates as [number, number],
        zoom: 15,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 400,
      });
  }
  return (
    <>
      <div
        className="map-canvas"
        ref={container}
        role="region"
        aria-label="Map of approved project locations"
      />
      {failure && (
        <p className="map-state" role="status">
          {failure}
        </p>
      )}
      <div className="map-key">
        <span>
          <i className="cluster-key" />
          Grouped locations · select to zoom
        </span>
        <span>
          <i className="point-key" />
          Individual project
        </span>
      </div>
      <div className="map-selection">
        <label>
          Find a mapped project
          <select
            aria-label="Find a mapped project"
            value={selected?.slug ?? ""}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Choose a project location</option>
            {data.geojson.features.map((f) => (
              <option value={f.properties.slug} key={f.properties.slug}>
                {f.properties.title} · {f.properties.community}
              </option>
            ))}
          </select>
        </label>
        <div aria-live="polite">
          {selected && (
            <article className="map-selected-record">
              <span className="eyebrow">
                {selected.code} · {selected.category}
              </span>
              <h3>{selected.title}</h3>
              <p>
                {selected.community} · {selected.status} · {selected.progress}%
              </p>
              <Link href={`/projects/${selected.slug}`} className="text-link">
                View approved project →
              </Link>
            </article>
          )}
        </div>
      </div>
    </>
  );
}
