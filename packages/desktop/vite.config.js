import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	plugins: [svelte()],
	
	envDir: path.resolve(__dirname, "..", ".."),
	
	// Ensure proper base path for electron
	base: './',
	
	// Public directory for static assets
	publicDir: 'static-compiled',
	
	// Build configuration
	build: {
		outDir: 'build',
		emptyOutDir: true,
		// Ensure compatibility with Electron
		target: 'chrome120',
		sourcemap: true,
		cssMinify: false,
		// Copy static assets to build output
		assetsDir: 'assets'
	},
	
	// Define globals for Electron context
	define: {
		global: 'globalThis'
	}
}); 
