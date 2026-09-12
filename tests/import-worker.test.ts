import assert from "node:assert/strict";
import { test } from "node:test";

test("import worker reports stages and forwards authenticated server errors", async () => {
  const originalFetch = globalThis.fetch;
  const messages: any[] = [];
  const worker = {
    postMessage: (message: unknown) => messages.push(message),
    onmessage: null as any,
  };
  Object.defineProperty(globalThis, "self", {
    value: worker,
    configurable: true,
  });
  try {
    await import("../src/lib/import-route.worker");
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/routes/import");
      assert.equal(init?.credentials, "same-origin");
      assert.deepEqual(JSON.parse(init?.body as string), {
        filename: "ride.gpx",
        content: "<gpx/>",
      });
      return Response.json({ id: "saved-route" });
    };
    await worker.onmessage({ data: new File(["<gpx/>"], "ride.gpx") });
    assert.deepEqual(messages, [
      { stage: "reading" },
      { stage: "importing" },
      { stage: "preparing", route: { id: "saved-route" } },
    ]);
    messages.length = 0;
    globalThis.fetch = async () =>
      Response.json({ error: "invalidFile" }, { status: 400 });
    await worker.onmessage({ data: new File(["bad"], "ride.gpx") });
    assert.deepEqual(messages.at(-1), { error: "invalidFile" });
    assert.equal(
      messages.some((m) => m.route),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "self");
  }
});
