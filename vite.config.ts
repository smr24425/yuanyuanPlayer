import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/yuanyuanPlayer/", //repo name
  plugins: [
    react(),
    VitePWA({
      manifestFilename: "site.webmanifest",
      manifest: {
        name: "淵淵播放器",
        short_name: "淵淵播放器",
        theme_color: "#fff",
        background_color: "#000",
        display: "fullscreen",
        start_url: "/yuanyuanPlayer/",
      },
      injectRegister: "auto",
      registerType: "autoUpdate",
    }),
  ],
});
