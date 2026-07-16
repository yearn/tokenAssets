import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {Header} from '../src/components/Header';
import '../src/index.css';

export const metadata: Metadata = {
	title: 'Image Tools',
	description: 'Upload token and chain assets to the Yearn token assets repository.'
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
	return (
		<html lang="en">
			<body>
				<div className="min-h-full bg-gray-50">
					<Header />
					<main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
				</div>
			</body>
		</html>
	);
}
