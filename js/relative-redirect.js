// Redirects are site-relative, so previews and the first-party stats alias stay on origin.
export function relativeRedirect(target, status = 307, headers = {}) {
  if (typeof target !== 'string' || !target.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(target)) {
    return new Response(null, {status:400});
  }
  try {
    const parsed = new URL(target, 'https://corvus.gent');
    const path = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    if (parsed.origin !== 'https://corvus.gent' || target.startsWith('//') ||
        parsed.pathname.startsWith('//') || path.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(path)) {
      return new Response(null, {status:400});
    }
  } catch {
    return new Response(null, {status:400});
  }
  return new Response(null, {status, headers:{...headers, Location:target}});
}
