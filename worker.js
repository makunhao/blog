export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/geo') {
      const cf = request.cf || {};
      const body = JSON.stringify({
        country: cf.country || '',
        region: cf.region || '',
        city: cf.city || '',
        lat: cf.latitude || '',
        lon: cf.longitude || ''
      });
      return new Response(body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*'
        }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
