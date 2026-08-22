// vite.config.js
import { defineConfig } from "file:///C:/Users/vanuz/OneDrive/%C3%81rea%20de%20Trabalho/Acex_Portaria-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/vanuz/OneDrive/%C3%81rea%20de%20Trabalho/Acex_Portaria-main/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Separa as libs grandes em chunks próprios: melhoram o cache
        // (mudam pouco) e tiram peso do bundle principal.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2YW51elxcXFxPbmVEcml2ZVxcXFxcdTAwQzFyZWEgZGUgVHJhYmFsaG9cXFxcQWNleF9Qb3J0YXJpYS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2YW51elxcXFxPbmVEcml2ZVxcXFxcdTAwQzFyZWEgZGUgVHJhYmFsaG9cXFxcQWNleF9Qb3J0YXJpYS1tYWluXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy92YW51ei9PbmVEcml2ZS8lQzMlODFyZWElMjBkZSUyMFRyYWJhbGhvL0FjZXhfUG9ydGFyaWEtbWFpbi92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgIGJ1aWxkOiB7XG4gICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgICAgIC8vIFNlcGFyYSBhcyBsaWJzIGdyYW5kZXMgZW0gY2h1bmtzIHByXHUwMEYzcHJpb3M6IG1lbGhvcmFtIG8gY2FjaGVcbiAgICAgICAgICAgICAgICAvLyAobXVkYW0gcG91Y28pIGUgdGlyYW0gcGVzbyBkbyBidW5kbGUgcHJpbmNpcGFsLlxuICAgICAgICAgICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICAgICAgICAgICBzdXBhYmFzZTogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdYLFNBQVMsb0JBQW9CO0FBQ3JaLE9BQU8sV0FBVztBQUNsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0gsZUFBZTtBQUFBLE1BQ1gsUUFBUTtBQUFBO0FBQUE7QUFBQSxRQUdKLGNBQWM7QUFBQSxVQUNWLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxVQUN6RCxVQUFVLENBQUMsdUJBQXVCO0FBQUEsUUFDdEM7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
