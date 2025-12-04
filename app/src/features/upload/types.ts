export type UploadMode = 'token' | 'chain';

export type FileKind = 'svg' | 'png32' | 'png128';

export type FileTriplet = Partial<Record<FileKind, File>>;

export type PreviewTriplet = Partial<Record<FileKind, string>>;

export type TokenDraft = {
	id: string;
	chainId: string;
	address: string;
	name?: string;
	genPng: boolean;
	files: FileTriplet;
	generated: FileTriplet;
	preview: PreviewTriplet;
	resolvingName: boolean;
	resolveError?: string;
};

export type ChainDraft = {
	chainId: string;
	genPng: boolean;
	files: FileTriplet;
	generated: FileTriplet;
	preview: PreviewTriplet;
};

export type ReviewMetadata = {
	title: string;
	body: string;
};

export type SubmitResult = {
	prUrl?: string;
	repository?: {owner: string; repo: string};
};
