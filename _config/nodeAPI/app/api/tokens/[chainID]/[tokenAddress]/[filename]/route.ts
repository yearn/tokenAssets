import type {TContext} from '@/helpers/types';

import {handleTokenRequest} from '@/helpers/tokenHelpers';

export async function GET(request: Request, context: TContext): Promise<Response> {
	return handleTokenRequest(request, context);
}
