export function buildAuthorizeUrl(clientId: string, state: string) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'public_repo');
  return url.toString();
}

