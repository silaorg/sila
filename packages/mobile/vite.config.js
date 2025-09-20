import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
	plugins: [svelte()],
	
	// Ensure proper base path for Capacitor
	base: './',
	
	// Build configuration
	build: {
		outDir: 'build',
		emptyOutDir: true,
		// Ensure compatibility with mobile browsers
		target: 'chrome120',
		sourcemap: true,
		cssMinify: false,
		// Copy static assets to build output
		assetsDir: 'assets'
	},
	
	// Define globals for mobile context
	define: {
		global: 'globalThis'
	},
	
	// Resolve configuration for monorepo debugging
	resolve: {
		preserveSymlinks: true
	}
}); 