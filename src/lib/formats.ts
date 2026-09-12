import { XMLParser } from "fast-xml-parser";
import { uid, validateGeometry } from "./geo";
import type { Geometry, Point } from "./types";
const array = (x: any): any[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
const point = (
  lat: any,
  lon: any,
  ele?: any,
  time?: any,
  speed?: any,
): Point => {
  const p: Point = { id: uid(), lat: Number(lat), lon: Number(lon) };
  if (ele !== undefined && ele !== "") p.ele = Number(ele);
  if (time) p.time = String(time);
  if (speed !== undefined) p.speed = Number(speed);
  return p;
};
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("invalidFile");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseRoute(
  text: string,
  filename: string,
): { title: string; geometry: Geometry } {
  if (Buffer.byteLength(text) > 25 * 1024 * 1024) throw Error("fileTooLarge");
  text = text.replace(/^\uFEFF/, "");
  let title = filename.replace(/\.[^.]+$/, ""),
    geometry: Geometry = [];
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "gpx" || ext === "kml") {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error("invalidFile");
    const doc = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      removeNSPrefix: true,
      processEntities: false,
      parseTagValue: false,
    }).parse(text);
    if (ext === "gpx") {
      if (!doc.gpx) throw Error("invalidFile");
      const g = doc.gpx;
      title =
        g.metadata?.name ||
        array(g.trk)[0]?.name ||
        array(g.rte)[0]?.name ||
        title;
      for (const trk of array(g.trk))
        for (const s of array(trk.trkseg))
          geometry.push(
            array(s.trkpt).map((p) =>
              point(
                p["@lat"],
                p["@lon"],
                p.ele,
                p.time,
                typeof p.extensions?.speed === "object"
                  ? p.extensions.speed["#text"]
                  : p.extensions?.speed,
              ),
            ),
          );
      for (const r of array(g.rte))
        geometry.push(
          array(r.rtept).map((p) => point(p["@lat"], p["@lon"], p.ele, p.time)),
        );
    } else {
      if (!doc.kml) throw Error("invalidFile");
      title = doc.kml.Document?.name || title;
      const walk = (o: any) => {
        if (!o || typeof o !== "object") return;
        for (const [key, value] of Object.entries(o)) {
          if (key === "LineString")
            for (const l of array(value)) {
              if (l.coordinates)
                geometry.push(
                  String(l.coordinates)
                    .trim()
                    .split(/\s+/)
                    .map((c) => {
                      const [lon, lat, ele] = c.split(",");
                      return point(lat, lon, ele);
                    }),
                );
            }
          else if (key === "Track")
            for (const t of array(value))
              geometry.push(
                array(t.coord).map((c, i) => {
                  const [lon, lat, ele] = String(c).trim().split(/\s+/);
                  return point(lat, lon, ele, array(t.when)[i]);
                }),
              );
          else for (const item of array(value)) walk(item);
        }
      };
      walk(doc.kml);
    }
  } else if (ext === "geojson" || ext === "json") {
    const doc = JSON.parse(text);
    const walk = (o: any) => {
      if (!o) return;
      if (o.type === "FeatureCollection")
        for (const f of o.features || []) walk(f);
      else if (o.type === "Feature") {
        title = o.properties?.name || o.properties?.title || title;
        walk(o.geometry);
      } else if (o.type === "GeometryCollection")
        for (const g of o.geometries || []) walk(g);
      else if (o.type === "LineString")
        geometry.push(o.coordinates.map((c: any[]) => point(c[1], c[0], c[2])));
      else if (o.type === "MultiLineString")
        for (const s of o.coordinates)
          geometry.push(s.map((c: any[]) => point(c[1], c[0], c[2])));
    };
    walk(doc);
  } else if (ext === "csv") {
    const rows = csvRows(text),
      headers = rows.shift()?.map((s) => s.trim().toLowerCase()) || [];
    const col = (name: string) => headers.indexOf(name);
    if (col("latitude") < 0 || col("longitude") < 0) throw Error("invalidFile");
    let last: string | undefined;
    for (const r of rows) {
      const segment = col("segment") >= 0 ? r[col("segment")] : "1";
      if (segment !== last) {
        geometry.push([]);
        last = segment;
      }
      geometry
        .at(-1)!
        .push(
          point(
            r[col("latitude")],
            r[col("longitude")],
            r[col("altitude_m")],
            r[col("timestamp")],
            r[col("speed_m_s")],
          ),
        );
    }
  } else throw Error("unsupportedFormat");
  geometry = geometry.filter((s) => s.length >= 2);
  return {
    title: String(title).slice(0, 120),
    geometry: validateGeometry(geometry),
  };
}
const esc = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function exportRoute(
  title: string,
  g: Geometry,
  format: string,
): { body: string; type: string; extension: string } {
  if (format === "geojson")
    return {
      body: JSON.stringify({
        type: "Feature",
        properties: { name: title },
        geometry: {
          type: "MultiLineString",
          coordinates: g.map((s) =>
            s.map((p) =>
              p.ele === undefined ? [p.lon, p.lat] : [p.lon, p.lat, p.ele],
            ),
          ),
        },
      }),
      type: "application/geo+json",
      extension: "geojson",
    };
  if (format === "csv")
    return {
      body:
        "segment,timestamp,latitude,longitude,altitude_m,speed_m_s\n" +
        g
          .flatMap((s, i) =>
            s.map((p) =>
              [
                i + 1,
                p.time ?? "",
                p.lat,
                p.lon,
                p.ele ?? "",
                p.speed ?? "",
              ].join(","),
            ),
          )
          .join("\n"),
      type: "text/csv",
      extension: "csv",
    };
  if (format === "kml")
    return {
      body: `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name><Placemark><MultiGeometry>${g.map((s) => `<LineString><coordinates>${s.map((p) => `${p.lon},${p.lat}${p.ele === undefined ? "" : "," + p.ele}`).join(" ")}</coordinates></LineString>`).join("")}</MultiGeometry></Placemark></Document></kml>`,
      type: "application/vnd.google-earth.kml+xml",
      extension: "kml",
    };
  if (format !== "gpx") throw Error("unsupportedFormat");
  return {
    body: `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="SpiderRoute" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(title)}</name>${g.map((s) => `<trkseg>${s.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele !== undefined ? `<ele>${p.ele}</ele>` : ""}${p.time ? `<time>${esc(p.time)}</time>` : ""}</trkpt>`).join("")}</trkseg>`).join("")}</trk></gpx>`,
    type: "application/gpx+xml",
    extension: "gpx",
  };
}
