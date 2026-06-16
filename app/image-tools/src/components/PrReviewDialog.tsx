import React, {Fragment} from 'react';
import {Dialog, Transition} from '@headlessui/react';

type Props = {
	open: boolean;
	title: string;
	body: string;
	submitting: boolean;
	onTitleChange: (value: string) => void;
	onBodyChange: (value: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
};

export const PrReviewDialog: React.FC<Props> = ({
	open,
	title,
	body,
	submitting,
	onTitleChange,
	onBodyChange,
	onCancel,
	onConfirm
}) => {
	return (
		<Transition
			show={open}
			as={Fragment}>
			<Dialog
				as="div"
				className="relative z-50"
				onClose={() => {
					if (!submitting) onCancel();
				}}>
				<div
					className="fixed inset-0 bg-black/30"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
						<Dialog.Title className="text-lg font-semibold text-gray-900">Review PR Details</Dialog.Title>
						<p className="mt-1 text-sm text-gray-600">
							Edit the title and description before creating the PR.
						</p>
						<div className="mt-4 space-y-4">
							<label className="block">
								<span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
								<input
									className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
									value={title}
									onChange={event => onTitleChange(event.target.value)}
								/>
							</label>
							<label className="block">
								<span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
								<textarea
									rows={10}
									className="block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
									value={body}
									onChange={event => onBodyChange(event.target.value)}
								/>
							</label>
						</div>
						<div className="mt-6 flex items-center justify-end gap-3">
							<button
								type="button"
								className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
								onClick={onCancel}
								disabled={submitting}>
								Cancel
							</button>
							<button
								type="button"
								className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								onClick={onConfirm}
								disabled={submitting}>
								{submitting ? 'Submitting...' : 'Create PR'}
							</button>
						</div>
					</Dialog.Panel>
				</div>
			</Dialog>
		</Transition>
	);
};
