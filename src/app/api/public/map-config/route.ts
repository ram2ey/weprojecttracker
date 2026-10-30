// Geoapify browser map keys are public, origin-restricted credentials. Return
// them only on demand; never expose other server environment variables.
export const dynamic = "force-dynamic";
export function GET() {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key)
    return Response.json(
      { configured: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    {
      configured: true,
      style: {
        version: 8,
        sources: {
          geoapify: {
            type: "raster",
            tiles: [
              `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`,
            ],
            tileSize: 256,
            attribution:
              'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
          },
        },
        layers: [
          {
            id: "base",
            type: "raster",
            source: "geoapify",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
