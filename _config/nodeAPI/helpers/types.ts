export type TContext = {
	params: Promise<{
		chainID: string;
		tokenAddress: string;
		filename: string;
	}>;
};
