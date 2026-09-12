import type { RouteData } from "./types";

// File decoding, JSON encoding and response parsing stay off the UI thread.
self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  try {
    self.postMessage({ stage: "reading" });
    const content = await file.text();
    const body = JSON.stringify({ filename: file.name, content });
    self.postMessage({ stage: "importing" });
    const response = await fetch("/api/routes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "error");
    self.postMessage({ stage: "preparing", route: result as RouteData });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "error",
    });
  }
};
