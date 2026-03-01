import { serve } from "bun";
import { join } from "path";

const PORT = process.env.PORT || 3000;
const DIST_DIR = "./dist";

console.log(`Starting production server on http://localhost:${PORT}`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Helper to add COOP/COEP headers
    const addHeaders = (res: Response) => {
      res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
      res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      return res;
    };

    // DeepL proxy — forwards requests to DeepL API to avoid browser CORS restrictions.
    if (url.pathname.startsWith("/deepl-proxy/")) {
      const parts = url.pathname.slice("/deepl-proxy/".length).split("/");
      const plan = parts[0];
      const apiPath = "/" + parts.slice(1).join("/");

      const deepLBase =
        plan === "pro"
          ? "https://api.deepl.com/v2"
          : "https://api-free.deepl.com/v2";

      const targetUrl = `${deepLBase}${apiPath}${url.search}`;
      const authKey = req.headers.get("X-DeepL-Auth-Key") ?? "";
      
      const proxyHeaders: Record<string, string> = {
        "Authorization": `DeepL-Auth-Key ${authKey}`
      };
      const contentType = req.headers.get("Content-Type");
      if (contentType) proxyHeaders["Content-Type"] = contentType;

      try {
        const upstream = await fetch(targetUrl, {
          method: req.method,
          headers: proxyHeaders,
          body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
        });

        const responseBody = await upstream.arrayBuffer();
        return new Response(responseBody, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ message: String(err) }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Static assets
    let filePath = join(DIST_DIR, url.pathname);
    if (url.pathname === "/") {
      filePath = join(DIST_DIR, "index.html");
    }

    let file = Bun.file(filePath);
    if (!(await file.exists())) {
      // SPA Fallback: serve index.html for unknown routes
      file = Bun.file(join(DIST_DIR, "index.html"));
    }

    const response = new Response(file);
    
    // Set COOP/COEP headers for SharedArrayBuffer support
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    
    // Set MIME types for specific files
    if (filePath.endsWith(".wasm")) {
      response.headers.set("Content-Type", "application/wasm");
    } else if (filePath.endsWith(".js")) {
      response.headers.set("Content-Type", "text/javascript");
    } else if (filePath.endsWith(".css")) {
      response.headers.set("Content-Type", "text/css");
    }

    return response;
  },
});
