// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
var __electron_vite_injected_dirname = "C:\\Users\\Dark\\OneDrive\\Desktop\\Trabajo\\ERP-Market\\desktop";
var electron_vite_config_default = defineConfig({
  // ── Main Process ─────────────────────────────────────────────────────────
  // Bundlea src/main/index.ts. externalizeDepsPlugin marca todos los
  // node_modules como externos (no los bundlea, los require() en runtime).
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        // Permite importar el backend con @backend/...
        "@backend": resolve(__electron_vite_injected_dirname, "../backend/src")
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__electron_vite_injected_dirname, "src/main/index.ts") }
      }
    }
  },
  // ── Preload Script ───────────────────────────────────────────────────────
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts") }
      }
    }
  },
  // ── Renderer Process (React / Vite) ──────────────────────────────────────
  // Usa el frontend/ existente como root del renderer.
  // En dev: electron-vite levanta un Vite dev server con HMR.
  // En prod: build genera out/renderer/ para electron-builder.
  renderer: {
    root: resolve(__electron_vite_injected_dirname, "../frontend"),
    build: {
      outDir: resolve(__electron_vite_injected_dirname, "out/renderer"),
      rollupOptions: {
        input: { index: resolve(__electron_vite_injected_dirname, "../frontend/index.html") }
      }
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__electron_vite_injected_dirname, "../frontend/src")
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
