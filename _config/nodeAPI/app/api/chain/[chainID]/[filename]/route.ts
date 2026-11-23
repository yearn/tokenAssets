import type {TChainContext} from '@/helpers/chainHelpers';

import {handleChainRequest} from '@/helpers/chainHelpers';

export async function GET(request: Request, context: TChainContext): Promise<Response> {
	return handleChainRequest(request, context);
}
