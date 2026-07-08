import React from 'react';

export type StatusTone = 'info' | 'success' | 'error';

const toneClasses: Record<StatusTone, string> = {
	info: 'border-blue-200 bg-blue-50 text-blue-900',
	success: 'border-green-200 bg-green-50 text-green-900',
	error: 'border-red-200 bg-red-50 text-red-900'
};

type Props = {
	tone: StatusTone;
	title: string;
	message?: string;
	action?: React.ReactNode;
	onDismiss?: () => void;
};

export const StatusBanner: React.FC<Props> = ({tone, title, message, action, onDismiss}) => {
	return (
		<div
			className={`rounded-md border px-4 py-3 text-sm ${toneClasses[tone]}`}
			role={tone === 'error' ? 'alert' : 'status'}>
			<div className="flex gap-3">
				<div className="min-w-0 flex-1">
					<p className="font-medium">{title}</p>
					{message && <p className="mt-1 opacity-90">{message}</p>}
					{action && <div className="mt-2">{action}</div>}
				</div>
				{onDismiss && (
					<button
						type="button"
						className="shrink-0 rounded px-1 text-current opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
						aria-label="Dismiss message"
						onClick={onDismiss}>
						x
					</button>
				)}
			</div>
		</div>
	);
};
