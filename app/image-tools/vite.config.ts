import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		allowedHosts: ['dev-vm.tail197cc7.ts.net']
	},
	preview: {
		allowedHosts: ['dev-vm.tail197cc7.ts.net']
	}
});
