import {resolve as resolvePath} from 'node:path';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
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
		coverage: {
			reporter: ['text', 'html'],
			include: ['src/shared/**/*.ts', 'api/**/*.ts']
		},
		environment: 'node',
		threads: false,
		poolOptions: {
			threads: {
				singleThread: true
			}
		},
		include: [...configDefaults.include, 'src/shared/**/*.test.ts', 'api/**/*.test.ts']
	}
});
