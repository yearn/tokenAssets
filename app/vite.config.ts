import {fileURLToPath} from 'node:url';
import {resolve as resolvePath} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {configDefaults} from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@shared': resolvePath(rootDir, 'src/shared')
		}
	},
	server: {
		port: 5173
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		coverage: {
			reporter: ['text', 'html'],
			include: ['src/shared/**/*.ts', 'src/lib/**/*.ts']
		},
		include: [...configDefaults.include, 'src/shared/**/*.test.ts'],
		exclude: [...configDefaults.exclude, 'src/test/helpers/**']
	}
});
