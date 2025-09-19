import React, {Fragment} from 'react';
import {Dialog, Transition} from '@headlessui/react';
import {ReviewMetadata} from '../../features/upload/types';

type ReviewDialogProps = {
	open: boolean;
	metadata: ReviewMetadata;
	submitting: boolean;
	error?: string | null;
	onChange(metadata: ReviewMetadata): void;
	onClose(): void;
	onConfirm(): void;
};

export const ReviewDialog: React.FC<ReviewDialogProps> = ({
	open,
	metadata,
	submitting,
	error,
	onChange,
	onClose,
	onConfirm
}) => (
	<Transition.Root show={open} as={Fragment}>
		<Dialog as="div" className="relative z-50" onClose={() => (!submitting ? onClose() : undefined)}>
			<Transition.Child
				as={Fragment}
				enter="ease-out duration-200"
				enterFrom="opacity-0"
				enterTo="opacity-100"
				leave="ease-in duration-150"
				leaveFrom="opacity-100"
				leaveTo="opacity-0">
				<div className="fixed inset-0 bg-gray-500 bg-opacity-60 transition-opacity" />
			</Transition.Child>

			<div className="fixed inset-0 z-50 overflow-y-auto">
				<div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center">
					<Transition.Child
						as={Fragment}
						enter="ease-out duration-200"
						enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
						enterTo="opacity-100 translate-y-0 sm:scale-100"
						leave="ease-in duration-150"
						leaveFrom="opacity-100 translate-y-0 sm:scale-100"
						leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
						<Dialog.Panel className="relative w-full max-w-2xl transform rounded-lg bg-white px-6 pb-6 pt-5 text-left shadow-xl transition-all">
							<Dialog.Title className="text-lg font-medium text-gray-900">Review pull request details</Dialog.Title>
							<div className="mt-4 space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700" htmlFor="pr-title">
										PR Title
									</label>
									<input
										type="text"
										id="pr-title"
										className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={metadata.title}
										onChange={event => onChange({...metadata, title: event.target.value})}
										disabled={submitting}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700" htmlFor="pr-body">
										PR Body
									</label>
									<textarea
										id="pr-body"
										rows={6}
										className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={metadata.body}
										onChange={event => onChange({...metadata, body: event.target.value})}
										disabled={submitting}
									/>
								</div>
								{error ? <p className="text-sm text-red-600">{error}</p> : null}
							</div>

							<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
								<button
									type="button"
									className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
									onClick={onClose}
									disabled={submitting}>
									Cancel
								</button>
								<button
									type="button"
									className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
									onClick={onConfirm}
									disabled={submitting}>
									{submitting ? 'Submitting…' : 'Confirm & Submit'}
								</button>
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</div>
		</Dialog>
	</Transition.Root>
);
