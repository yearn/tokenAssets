type RepoInfo = {
  default_branch: string;
};

type RefObject = {
  object: { sha: string };
};

async function gh<T>(token: string, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function getUserLogin(token: string): Promise<string> {
  const data = await gh<{ login: string }>(token, 'GET', 'https://api.github.com/user');
  return data.login;
}

export async function getRepoInfo(token: string, owner: string, repo: string): Promise<RepoInfo> {
  return gh<RepoInfo>(token, 'GET', `https://api.github.com/repos/${owner}/${repo}`);
}

export async function getHeadRef(token: string, owner: string, repo: string, branch: string): Promise<RefObject> {
  // GitHub API path uses 'refs' (plural)
  return gh<RefObject>(token, 'GET', `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`);
}

export async function getCommit(token: string, owner: string, repo: string, commitSha: string): Promise<{ sha: string; tree: { sha: string } }>{
  return gh(token, 'GET', `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`);
}

export async function createBlob(token: string, owner: string, repo: string, contentBase64: string): Promise<{ sha: string }>{
  return gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/git/blobs`, { content: contentBase64, encoding: 'base64' });
}

export async function createTree(token: string, owner: string, repo: string, baseTreeSha: string, entries: Array<{ path: string; mode: string; type: string; sha: string }>): Promise<{ sha: string }>{
  return gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/git/trees`, { base_tree: baseTreeSha, tree: entries });
}

export async function createCommit(token: string, owner: string, repo: string, message: string, treeSha: string, parentSha: string): Promise<{ sha: string }>{
  return gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/git/commits`, { message, tree: treeSha, parents: [parentSha] });
}

export async function createRef(token: string, owner: string, repo: string, branch: string, sha: string): Promise<{ ref: string }>{
  return gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
}

export async function createPullRequest(token: string, owner: string, repo: string, title: string, head: string, base: string, body: string): Promise<{ html_url: string }>{
  return gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/pulls`, { title, head, base, body });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function commitExists(token: string, owner: string, repo: string, commitSha: string): Promise<boolean> {
	try {
		await getCommit(token, owner, repo, commitSha);
		return true;
	} catch {
		return false;
	}
}

async function syncForkWithUpstream(token: string, owner: string, repo: string, branch: string) {
	try {
		await gh(token, 'POST', `https://api.github.com/repos/${owner}/${repo}/merge-upstream`, {
			branch,
		});
	} catch (e: any) {
		const msg = String(e?.message || '');
		if (msg.includes('409') || msg.includes('422')) {
			throw new Error('Unable to sync your fork with the upstream repository. Please update your fork to match upstream and retry.');
		}
		throw e;
	}
}

async function ensureForkHasCommit(token: string, owner: string, repo: string, branch: string, commitSha: string) {
	const exists = await commitExists(token, owner, repo, commitSha);
	if (exists) return;
	await syncForkWithUpstream(token, owner, repo, branch);
	const stillMissing = !(await commitExists(token, owner, repo, commitSha));
	if (stillMissing) throw new Error('Unable to prepare fork for PR creation. Please sync your fork with upstream and try again.');
}

export async function ensureFork(token: string, baseOwner: string, baseRepo: string, login?: string): Promise<{ owner: string; repo: string }>{
  const user = login || (await getUserLogin(token));
  // Trigger fork (idempotent)
  await gh(token, 'POST', `https://api.github.com/repos/${baseOwner}/${baseRepo}/forks`);
  // Poll for availability
  for (let i = 0; i < 10; i++) {
    try {
      await gh(token, 'GET', `https://api.github.com/repos/${user}/${baseRepo}`);
      return { owner: user, repo: baseRepo };
    } catch {
      await sleep(800);
    }
  }
  // Last try; let it throw if still not ready
  await gh(token, 'GET', `https://api.github.com/repos/${user}/${baseRepo}`);
  return { owner: user, repo: baseRepo };
}

async function openPrWithFilesDirect(params: {
  token: string;
  owner: string; // repo where commit happens
  repo: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}) {
  const { token, owner, repo } = params;
  const repoInfo = await getRepoInfo(token, owner, repo);
  const baseBranch = repoInfo.default_branch;
  const headRef = await getHeadRef(token, owner, repo, baseBranch);
  const baseCommitSha = headRef.object.sha;
  const baseCommit = await getCommit(token, owner, repo, baseCommitSha);
  return { baseBranch, baseCommit };
}

export async function openPrWithFilesToBaseFromHead(params: {
  token: string;
  baseOwner: string; // where PR is opened
  baseRepo: string;
  headOwner: string; // where branch/commit happen
  headRepo: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  files: Array<{ path: string; contentBase64: string }>;
}) {
  const { token, baseOwner, baseRepo, headOwner, headRepo } = params;

  const baseInfo = await getRepoInfo(token, baseOwner, baseRepo);
  const baseBranch = baseInfo.default_branch;

  const baseRef = await getHeadRef(token, baseOwner, baseRepo, baseBranch);
  const baseCommitSha = baseRef.object.sha;
  const baseCommit = await getCommit(token, baseOwner, baseRepo, baseCommitSha);

  if (headOwner !== baseOwner || headRepo !== baseRepo) {
	const headInfo = await getRepoInfo(token, headOwner, headRepo);
	const headBaseBranch = headInfo.default_branch;
	await ensureForkHasCommit(token, headOwner, headRepo, headBaseBranch, baseCommitSha);
  }

  const blobShas: Array<{ path: string; sha: string }> = [];
  for (const f of params.files) {
    const blob = await createBlob(token, headOwner, headRepo, f.contentBase64);
    blobShas.push({ path: f.path, sha: blob.sha });
  }

  const tree = await createTree(
    token,
    headOwner,
    headRepo,
    baseCommit.tree.sha,
    blobShas.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha }))
  );

  const commit = await createCommit(token, headOwner, headRepo, params.commitMessage, tree.sha, baseCommitSha);

  await createRef(token, headOwner, headRepo, params.branchName, commit.sha);

  // Open PR in base repo using head owner:branch
  const pr = await createPullRequest(
    token,
    baseOwner,
    baseRepo,
    params.prTitle,
    `${headOwner}:${params.branchName}`,
    baseBranch,
    params.prBody
  );
  return pr.html_url;
}

export async function openPrWithFilesForkAware(params: {
  token: string;
  baseOwner: string; // target repo owner (org)
  baseRepo: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  files: Array<{ path: string; contentBase64: string }>;
}) {
  // Try direct (may fail with 403 due to org OAuth restrictions)
  try {
    const { baseBranch, baseCommit } = await openPrWithFilesDirect({
      token: params.token,
      owner: params.baseOwner,
      repo: params.baseRepo,
      branchName: params.branchName,
      commitMessage: params.commitMessage,
      prTitle: params.prTitle,
      prBody: params.prBody,
    });

    const blobShas: Array<{ path: string; sha: string }> = [];
    for (const f of params.files) {
      const blob = await createBlob(params.token, params.baseOwner, params.baseRepo, f.contentBase64);
      blobShas.push({ path: f.path, sha: blob.sha });
    }
    const tree = await createTree(
      params.token,
      params.baseOwner,
      params.baseRepo,
      baseCommit.tree.sha,
      blobShas.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha }))
    );
    const commit = await createCommit(params.token, params.baseOwner, params.baseRepo, params.commitMessage, tree.sha, baseCommit.sha);
    await createRef(params.token, params.baseOwner, params.baseRepo, params.branchName, commit.sha);
    const pr = await createPullRequest(params.token, params.baseOwner, params.baseRepo, params.prTitle, params.branchName, baseBranch, params.prBody);
    return pr.html_url;
  } catch (e: any) {
    const msg = String(e?.message || '');
    const is403 = msg.includes(' 403:') || msg.includes('status":"403');
    if (!is403) throw e;
    // Fallback to fork flow
    const login = await getUserLogin(params.token);
    const head = await ensureFork(params.token, params.baseOwner, params.baseRepo, login);
    return openPrWithFilesToBaseFromHead({
      token: params.token,
      baseOwner: params.baseOwner,
      baseRepo: params.baseRepo,
      headOwner: head.owner,
      headRepo: head.repo,
      branchName: params.branchName,
      commitMessage: params.commitMessage,
      prTitle: params.prTitle,
      prBody: params.prBody,
      files: params.files,
    });
  }
}

export async function openPrWithFiles(params: {
  token: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  files: Array<{ path: string; contentBase64: string }>; // repo-relative paths
}) {
  const { token, owner, repo } = params;
  const repoInfo = await getRepoInfo(token, owner, repo);
  const baseBranch = params.baseBranch || repoInfo.default_branch;
  const headRef = await getHeadRef(token, owner, repo, baseBranch);
  const baseCommitSha = headRef.object.sha;
  const baseCommit = await getCommit(token, owner, repo, baseCommitSha);

  // Create tree entries from provided files (already base64-encoded)
  const blobShas: Array<{ path: string; sha: string }> = [];
  for (const f of params.files) {
    const blob = await createBlob(token, owner, repo, f.contentBase64);
    blobShas.push({ path: f.path, sha: blob.sha });
  }

  const tree = await createTree(
    token,
    owner,
    repo,
    baseCommit.tree.sha,
    blobShas.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha }))
  );

  const commit = await createCommit(token, owner, repo, params.commitMessage, tree.sha, baseCommitSha);

  await createRef(token, owner, repo, params.branchName, commit.sha);

  const pr = await createPullRequest(token, owner, repo, params.prTitle, params.branchName, baseBranch, params.prBody);
  return pr.html_url;
}
