import React from 'react';

type Option = {value: string; label: string};

export function SegmentedToggle({
	options,
	value,
	onChange,
	className
}: {
	options: Option[];
	value: string;
	onChange: (v: string) => void;
	className?: string;
}) {
	const selectedIndex = Math.max(
		0,
		options.findIndex(option => option.value === value)
	);

	return (
		<div className={`relative select-none ${className ?? 'w-full max-w-md'}`}>
			<div
				className="grid rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm"
				style={{gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`}}
			>
				<div
					className="absolute inset-y-0 left-0 z-0 h-full transform rounded-lg bg-blue-600 transition-transform"
					style={{width: `${100 / options.length}%`, transform: `translateX(${selectedIndex * 100}%)`}}
				/>
				{options.map(option => {
					const active = option.value === value;
					return (
						<button
							key={option.value}
							type="button"
							className={`relative z-10 px-3 py-1.5 ${active ? 'text-white' : 'text-gray-700'}`}
							onClick={() => onChange(option.value)}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
