// GitHub Actions receives a temporary cookie restricted to one Vercel deployment.
export function previewState(base) {
  if (!process.env.CUBE_PREVIEW_ACCESS) return undefined;
  const {host, cookie} = JSON.parse(process.env.CUBE_PREVIEW_ACCESS);
  if (!/^loading-website-[a-z0-9-]+-corvus11\.vercel\.app$/.test(host) ||
      base !== 'https://' + host || typeof cookie !== 'string' || !cookie) {
    throw new Error('Preview access does not match the requested deployment.');
  }
  return {
    cookies: [{name: '_vercel_jwt', value: cookie, domain: host, path: '/',
      expires: -1, httpOnly: true, secure: true, sameSite: 'Lax'}],
    origins: [],
  };
}
