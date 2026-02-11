import { serve, build, spawn } from "bun";
import { join } from "path";
import { mkdir } from "fs/promises";

const PORT = 3000;

// Ensure dist exists
await mkdir("./dist", { recursive: true });

// Start Tailwind CLI in watch mode
console.log("Starting Tailwind CLI...");
const tailwindProc = spawn({
  cmd: [
    "./node_modules/.bin/tailwindcss",
    "-c",
    "./tailwind.config.cjs",
    "-i",
    "./src/index.css",
    "-o",
    "./dist/index.css",
    "--watch",
  ],
  stdout: "inherit",
  stderr: "inherit",
});

// Handle cleanup
process.on("SIGINT", () => {
  tailwindProc.kill();
  process.exit();
});

console.log(`Starting dev server on http://localhost:${PORT}`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const start = performance.now();

    const logRequest = (status: number, extra: string = "") => {
      const duration = (performance.now() - start).toFixed(2);
      const color = status >= 400 ? "\x1b[31m" : "\x1b[32m"; // Red for errors, Green for success
      const reset = "\x1b[0m";
      console.log(
        `${color}[${req.method}] ${status} ${url.pathname}${reset} (${duration}ms) ${extra}`,
      );
    };

    // Helper to add COOP/COEP headers
    const addHeaders = (res: Response) => {
      res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
      res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      logRequest(res.status);
      return res;
    };

    // Root -> index.html
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return addHeaders(new Response(Bun.file("./src/index.html")));
    }

    // JS Bundle
    if (url.pathname === "/index.js") {
      const result = await build({
        entrypoints: ["./src/index.tsx"],
        target: "browser",
        sourcemap: "inline",
      });

      if (!result.success) {
        return new Response("Build failed\n" + result.logs.join("\n"), {
          status: 500,
        });
      }

      return addHeaders(new Response(result.outputs[0]));
    }

    // CSS
    if (url.pathname === "/index.css") {
      const cssFile = Bun.file("./dist/index.css");
      if (await cssFile.exists()) {
        return addHeaders(new Response(cssFile));
      }
      // Fallback if not yet generated
      return addHeaders(
        new Response("/* CSS building... reload in a moment */", {
          headers: { "Content-Type": "text/css" },
        }),
      );
    }

    // Static assets
    const srcFile = Bun.file(join("./src", url.pathname));
    if (await srcFile.exists()) {
      return addHeaders(new Response(srcFile));
    }

    const publicFile = Bun.file(join("./public", url.pathname));
    if (await publicFile.exists()) {
      const response = new Response(publicFile);
      response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
      response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");

      // Set correct MIME types
      if (url.pathname.endsWith(".wasm")) {
        response.headers.set("Content-Type", "application/wasm");
      } else if (url.pathname.endsWith(".js")) {
        response.headers.set("Content-Type", "text/javascript");
      }

      logRequest(200, `[public]`);
      return response;
    }

    return addHeaders(new Response("Not found", { status: 404 }));
  },
});
