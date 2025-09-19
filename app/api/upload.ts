export const config = {runtime: 'nodejs'};

import {getUserLogin, openPrWithFilesForkAware} from './github';
import {
	UploadValidationError,
	buildDefaultPrMetadata,
	buildPrFiles,
	parseUploadForm
} from './_lib/upload';

const CANONICAL_OWNER = 'yearn';
const CANONICAL_REPO = 'tokenAssets';

type TargetRepo = {
	owner: string;
	repo: string;
	reason: 'canonical' | 'override';
	allowOverride: boolean;
};

function resolveTargetRepo(): TargetRepo {
	const envOwner = (process.env.REPO_OWNER as string | undefined)?.trim();
	const envRepo = (process.env.REPO_NAME as string | undefined)?.trim();
	const vercelOwner = (process.env.VERCEL_GIT_REPO_OWNER as string | undefined)?.trim();
	const vercelRepo = (process.env.VERCEL_GIT_REPO_SLUG as string | undefined)?.trim();
	const allowOverride = (process.env.ALLOW_REPO_OVERRIDE || '').toLowerCase() === 'true';

	let owner = CANONICAL_OWNER;
	let repo = CANONICAL_REPO;
	let reason: TargetRepo['reason'] = 'canonical';

	if (envOwner && envRepo) {
		const isSelfDeploy =
			vercelOwner && vercelRepo
				? envOwner.toLowerCase() === vercelOwner.toLowerCase() && envRepo.toLowerCase() === vercelRepo.toLowerCase()
				: false;
		if (allowOverride || !isSelfDeploy) {
			owner = envOwner;
			repo = envRepo;
			reason = 'override';
		}
	}

	console.info('[api/upload] target repository resolved', {
		owner,
		repo,
		reason,
		allowOverride
	});

	return {owner, repo, reason, allowOverride};
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {'Content-Type': 'application/json'}
	});
}

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'POST') return new Response('Method Not Allowed', {status: 405});
	try {
		const auth = req.headers.get('authorization') || '';
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
		if (!token) {
			return jsonResponse(401, {error: 'Missing GitHub token', code: 'AUTH_REQUIRED'});
		}

		const form = await req.formData();
		const parsed = await parseUploadForm(form);
		const prFiles = buildPrFiles(parsed);
		const metadata = buildDefaultPrMetadata(parsed, parsed.overrides);
		const {owner, repo} = resolveTargetRepo();
		const login = await getUserLogin(token).catch(() => 'user');
		const branchName = `${login}-image-tools-${parsed.target}-${Date.now()}`;

		const prUrl = await openPrWithFilesForkAware({
			token,
			baseOwner: owner,
			baseRepo: repo,
			branchName,
			commitMessage: metadata.title,
			prTitle: metadata.title,
			prBody: metadata.body,
			files: prFiles
		});

		return jsonResponse(200, {
			ok: true,
			prUrl,
			repository: {owner, repo}
		});
	} catch (error: any) {
		if (error instanceof UploadValidationError) {
			return jsonResponse(error.status, {
				error: error.message,
				details: error.details,
				code: error.code || 'UPLOAD_VALIDATION_FAILED'
			});
		}
		console.error('[api/upload] unexpected error', error);
		return jsonResponse(500, {error: 'Upload failed'});
	}
}
