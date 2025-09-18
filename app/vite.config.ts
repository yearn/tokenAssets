import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {configDefaults} from 'vitest/config';

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		coverage: {
			reporter: ['text', 'html']
		},
		exclude: [...configDefaults.exclude, 'src/test/helpers/**']
	}
});
