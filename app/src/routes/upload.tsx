import React, {useEffect, useMemo, useState} from 'react';
import {createRoute} from '@tanstack/react-router';
import {rootRoute} from '../router';
import {SegmentedToggle} from '../components/SegmentedToggle';
import {AUTH_CHANGE_EVENT, TOKEN_STORAGE_KEY, readStoredToken} from '../lib/githubAuth';
import {TokenAssetCard} from '../components/upload/TokenAssetCard';
import {ChainAssetCard} from '../components/upload/ChainAssetCard';
import {ReviewDialog} from '../components/upload/ReviewDialog';
import {useUploadForm} from '../features/upload/useUploadForm';

const CHAIN_LIST_ID = 'upload-chain-options';

export const UploadComponent: React.FC = () => {
	const [authToken, setAuthToken] = useState<string | null>(() => readStoredToken());
	const form = useUploadForm();
	const primaryToken = form.tokens[0];

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const updateToken = () => setAuthToken(readStoredToken());
		const onStorage = (event: StorageEvent) => {
			if (!event.key || event.key === TOKEN_STORAGE_KEY) updateToken();
		};
		const onAuth = () => updateToken();
		window.addEventListener('storage', onStorage);
		window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
		};
	}, []);

	const knownChainOptions = useMemo(() => form.knownChains, [form.knownChains]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!authToken) {
			alert('Sign in with GitHub before submitting.');
			return;
		}
		if (!form.canSubmit) return;
		form.openReview();
	};

	const handleConfirm = async () => {
		if (!authToken) {
			alert('Sign in with GitHub before submitting.');
			return;
		}
		try {
			const result = await form.submit({token: authToken});
			form.closeReview();
			if (result?.prUrl) {
				window.open(result.prUrl, '_blank');
			} else {
				alert('Upload complete. Review the PR in GitHub.');
			}
		} catch (error) {
			console.error('Upload failed', error);
		}
	};

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			{!authToken ? (
				<p className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
					Sign in with GitHub to enable submission. You can still prepare the upload while signed out.
				</p>
			) : null}

			<form onSubmit={handleSubmit} className="space-y-6 rounded-md border bg-white p-6 shadow-sm">
				{form.mode === 'chain' ? (
					<ChainAssetCard
						title="First asset to add"
						actions={
							<>
								<button
									type="button"
									className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
									onClick={() => form.resetChainDraft()}>
									Clear
								</button>
								<SegmentedToggle
									className="max-w-xs"
									options={[
										{value: 'token', label: 'Token Asset'},
										{value: 'chain', label: 'Chain Asset'}
									]}
									value={form.mode}
									onChange={value => form.setMode(value as 'token' | 'chain')}
								/>
							</>
						}
						draft={form.chain}
						chainListId={CHAIN_LIST_ID}
						onChainIdChange={value => form.setChainField({chainId: value})}
						onToggleGenerate={enabled => form.setChainGenPng(enabled)}
						onFileSelect={(kind, file) => form.handleChainFileChange(kind, file)}
					/>
				) : primaryToken ? (
					<>
						<TokenAssetCard
							title="First asset to add"
							actions={
								<>
									<button
										type="button"
										className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
										onClick={() => form.resetTokenDraft(primaryToken.id)}>
										Clear
									</button>
									<SegmentedToggle
										className="max-w-xs"
										options={[
											{value: 'token', label: 'Token Asset'},
											{value: 'chain', label: 'Chain Asset'}
										]}
										value={form.mode}
										onChange={value => form.setMode(value as 'token' | 'chain')}
									/>
								</>
							}
							draft={primaryToken}
							chainListId={CHAIN_LIST_ID}
							onChainIdChange={value => form.setTokenField(primaryToken.id, {chainId: value})}
							onAddressChange={value => form.setTokenField(primaryToken.id, {address: value})}
							onNameChange={value => form.setTokenField(primaryToken.id, {name: value})}
							onToggleGenerate={enabled => form.setTokenGenPng(primaryToken.id, enabled)}
							onFileSelect={(kind, file) => form.handleTokenFileChange(primaryToken.id, kind, file)}
							onResolveName={() => form.resolveTokenName(primaryToken.id)}
						/>

						{form.tokens.slice(1).map((token, index) => (
							<TokenAssetCard
								key={token.id}
								title={`Token Asset #${index + 2}`}
								actions={
									<>
										<button
											type="button"
											className="text-sm text-gray-600 hover:underline"
											onClick={() => form.resetTokenDraft(token.id)}>
											Clear
										</button>
										<button
											type="button"
											className="text-sm text-red-600 hover:underline"
											onClick={() => form.removeToken(token.id)}>
											Remove
										</button>
									</>
								}
								draft={token}
								chainListId={CHAIN_LIST_ID}
								onChainIdChange={value => form.setTokenField(token.id, {chainId: value})}
								onAddressChange={value => form.setTokenField(token.id, {address: value})}
								onNameChange={value => form.setTokenField(token.id, {name: value})}
								onToggleGenerate={enabled => form.setTokenGenPng(token.id, enabled)}
								onFileSelect={(kind, file) => form.handleTokenFileChange(token.id, kind, file)}
								onResolveName={() => form.resolveTokenName(token.id)}
							/>
						))}

						<div>
							<button
								type="button"
								className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
								onClick={form.addToken}>
								+ Add Token Asset
							</button>
						</div>
					</>
				) : null}

				<div className="flex justify-end">
					<button
						type="submit"
						disabled={!form.canSubmit || !authToken}
						className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						title={!authToken ? 'Sign in with GitHub to enable submission' : undefined}>
						Submit PR
					</button>
				</div>
			</form>

			<ReviewDialog
				open={form.review.open}
				metadata={form.review.metadata}
				submitting={form.submitting}
				error={form.reviewError}
				onChange={form.setReviewMetadata}
				onClose={form.closeReview}
				onConfirm={handleConfirm}
			/>

			<datalist id={CHAIN_LIST_ID}>
				{knownChainOptions.map(option => (
					<option key={option.id} value={String(option.id)}>
						{option.name}
					</option>
				))}
			</datalist>
		</div>
	);
};

export const UploadRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: UploadComponent
});
