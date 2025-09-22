export const config = {runtime: 'edge'};

import {getUserLogin, openPrWithFilesForkAware} from './github';
import {
	UploadValidationError,
	buildDefaultPrMetadata,
	buildPrFiles,
	parseUploadForm
} from './_lib/upload';

function readEnv(key: string): string | undefined {
	if (typeof process !== 'undefined' && process.env) {
		const raw = process.env[key];
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			return trimmed ? trimmed : undefined;
		}
	}
	return undefined;
}

const CANONICAL_OWNER = 'yearn';
const CANONICAL_REPO = 'tokenAssets';

type TargetRepo = {
	owner: string;
	repo: string;
	reason: 'canonical' | 'override';
	allowOverride: boolean;
};

function getHeader(req: any, key: string): string | undefined {
	const headers = (req as any)?.headers;
	if (!headers) return undefined;
	const lower = key.toLowerCase();
	if (typeof headers.get === 'function') {
		const value = headers.get(key) ?? headers.get(lower);
		return value ?? undefined;
	}
	const value = headers[key] ?? headers[lower];
	if (Array.isArray(value)) return value[0];
	return typeof value === 'string' ? value : undefined;
}

function resolveTargetRepo(): TargetRepo {
	const envOwner = readEnv('REPO_OWNER');
	const envRepo = readEnv('REPO_NAME');
	const vercelOwner = readEnv('VERCEL_GIT_REPO_OWNER');
	const vercelRepo = readEnv('VERCEL_GIT_REPO_SLUG');
	const allowOverrideRaw = readEnv('ALLOW_REPO_OVERRIDE');
	const allowOverride = (allowOverrideRaw || '').toLowerCase() === 'true';

	let owner = CANONICAL_OWNER;
	let repo = CANONICAL_REPO;
	let reason: TargetRepo['reason'] = 'canonical';

	if (envOwner && envRepo) {
		const envOwnerLower = envOwner.toLowerCase();
		const envRepoLower = envRepo.toLowerCase();
		const vercelOwnerLower = vercelOwner?.toLowerCase();
		const vercelRepoLower = vercelRepo?.toLowerCase();
		const isSelfDeploy = Boolean(vercelOwnerLower && vercelRepoLower) && envOwnerLower === vercelOwnerLower && envRepoLower === vercelRepoLower;
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
		const auth = getHeader(req, 'authorization') || '';
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
