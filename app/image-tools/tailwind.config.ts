import type {Config} from 'tailwindcss';

export default {
	content: ['./app/**/*.{ts,tsx,js,jsx}', './src/**/*.{ts,tsx,js,jsx}'],
	theme: {
		extend: {}
	},
	plugins: []
} satisfies Config;
