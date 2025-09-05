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
  return gh<RefObject>(token, 'GET', `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`);
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

