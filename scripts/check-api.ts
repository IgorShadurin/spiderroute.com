import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
async function main() {
  const base = process.env.TEST_BASE_URL || "http://localhost:3210";
  async function login(file: string) {
    const content = readFileSync(file, "utf8");
    const user = JSON.parse(
      content.split("\n").find((l) => l.startsWith("{"))!,
    );
    let cookies = new Map<string, string>();
    const request = async (
      path: string,
      method = "GET",
      data?: any,
      form = false,
    ) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
          Origin: base,
          ...(data
            ? {
                "Content-Type": form
                  ? "application/x-www-form-urlencoded"
                  : "application/json",
              }
            : {}),
        },
        body: data
          ? form
            ? new URLSearchParams(data).toString()
            : JSON.stringify(data)
          : undefined,
        redirect: "manual",
      });
      for (const cookie of r.headers.getSetCookie()) {
        const [pair] = cookie.split(";"),
          index = pair.indexOf("=");
        cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return r;
    };
    const csrf = await (await request("/api/auth/csrf")).json();
    const auth = await request(
      "/api/auth/callback/credentials",
      "POST",
      {
        email: user.email,
        password: user.password,
        csrfToken: csrf.csrfToken,
        callbackUrl: base + "/workspace",
        json: "true",
      },
      true,
    );
    assert.equal(auth.status, 200);
    const me = await request("/api/me");
    assert.equal(me.status, 200);
    return request;
  }
  const a = await login(process.env.TEST_USER_ONE || "private/demo-one.json"),
    b = await login(process.env.TEST_USER_TWO || "private/demo-two.json");
  const points = Array.from({ length: 16162 }, (_, i) => ({
    id: "synthetic-" + i,
    lat: 38.71 + Math.sin(i / 500) * 0.006,
    lon: -9.2 + i * 0.000006,
  }));
  let res = await a("/api/routes", "POST", {
    title: "Synthetic QA route",
    geometry: [points],
  });
  assert.equal(res.status, 201);
  let route = await res.json();
  assert.equal((await b("/api/routes/" + route.id)).status, 404);
  assert.equal((await fetch(base + "/api/routes/" + route.id)).status, 401);
  const pre = await (
    await a("/api/routes/" + route.id + "/preview", "POST", route)
  ).json();
  assert.ok(pre.geometry.length);
  res = await a("/api/routes/" + route.id + "/share", "POST", {
    revision: route.revision,
    confirm: true,
  });
  assert.equal(res.status, 200);
  const { token } = await res.json();
  const publicResponse = await fetch(base + "/api/public/" + token);
  assert.equal(publicResponse.status, 200);
  assert.match(publicResponse.headers.get("cache-control")!, /no-store/);
  const published = await publicResponse.json();
  assert.ok(published.stats.points < points.length);
  const clone = await (
    await b("/api/public/" + token + "/clone", "POST", {})
  ).json();
  assert.equal(clone.shared, false);
  assert.deepEqual(clone.geometry, published.geometry);
  assert.equal(
    (await b("/api/public/" + token + "/favorite", "POST", {})).status,
    200,
  );
  route.title = "Updated synthetic QA route";
  res = await a("/api/routes/" + route.id, "PUT", route);
  assert.equal(res.status, 200);
  route = await res.json();
  assert.equal(
    (await (await fetch(base + "/api/public/" + token)).json()).title,
    route.title,
  );
  for (const format of ["gpx", "kml", "geojson", "csv"])
    assert.equal(
      (await fetch(base + "/api/public/" + token + "/export?format=" + format))
        .status,
      200,
    );
  const start = performance.now();
  await Promise.all(
    Array.from({ length: 100 }, async () =>
      assert.equal((await fetch(base + "/api/public/" + token)).status, 200),
    ),
  );
  console.log(
    "100 concurrent public reads completed in " +
      Math.round(performance.now() - start) +
      " ms",
  );
  await a("/api/routes/" + route.id + "/share", "DELETE");
  assert.equal((await fetch(base + "/api/public/" + token)).status, 404);
  assert.equal((await b("/api/routes/" + clone.id)).status, 200);
  await a("/api/routes/" + route.id, "DELETE");
  await b("/api/routes/" + clone.id, "DELETE");
  console.log(
    "API integration checks passed: auth, ownership, 16k points, sharing, clone, favorites, exports, concurrent reads, revocation.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
