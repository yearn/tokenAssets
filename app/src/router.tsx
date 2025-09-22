import {Outlet, createRootRoute, createRouter} from '@tanstack/react-router';
import React from 'react';
import {Header} from './components/Header';
import {GithubSuccessRoute} from './routes/auth/github-success';
import {UploadRoute} from './routes/upload';

const RootComponent: React.FC = () => {
	return (
		<div className="min-h-full bg-gray-50">
			<Header />
			<main className="mx-auto max-w-5xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
};

export const rootRoute = createRootRoute({
	component: RootComponent
});

const routeTree = rootRoute.addChildren([UploadRoute, GithubSuccessRoute]);

export const router = createRouter({routeTree});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
