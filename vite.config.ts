import { defineConfig } from 'vite';

// Served from the root of the custom domain (https://isthisagrilledcheese.com/),
// so the base is '/'. If you ever drop the custom domain and use the project
// page instead, change this back to '/CheeseWizard/'.
export default defineConfig({
  base: '/',
});
