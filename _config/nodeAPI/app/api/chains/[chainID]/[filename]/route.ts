import type {TContext} from '@/helpers/types';

import {handleChainRequest} from '@/helpers/chainHelpers';

export async function GET(request: Request, context: TContext): Promise<Response> {
	return handleChainRequest(request, context);
}
