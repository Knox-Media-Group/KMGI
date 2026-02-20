// KMGI Roku Video Proxy - Cloudflare Worker
// Fetches fresh Vimeo HLS URLs and redirects Roku to them

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'KMGI Roku Video Proxy',
        provider: 'Knox Media Group'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Video proxy: /play/{video_id}
    const match = path.match(/^\/play\/(\d+)$/);
    if (!match) {
      return new Response('Not Found', { status: 404 });
    }

    const videoId = match[1];

    try {
      // Fetch fresh video data from Vimeo API
      const vimeoResp = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${env.VIMEO_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      });

      if (!vimeoResp.ok) {
        return new Response(`Video ${videoId} not found`, { status: 404 });
      }

      const data = await vimeoResp.json();

      // Find best playable URL
      let hlsUrl = null;

      // Prefer HLS from play representation (adaptive streaming)
      if (data.play && data.play.hls && data.play.hls.link) {
        hlsUrl = data.play.hls.link;
      }

      // Fallback: check files array for HLS
      if (!hlsUrl && data.files) {
        const hlsFile = data.files.find(f => f.quality === 'hls' || (f.type && f.type.includes('m3u8')));
        if (hlsFile) {
          hlsUrl = hlsFile.link;
        }
      }

      // Fallback: use highest quality progressive file
      if (!hlsUrl && data.files) {
        const progressive = data.files
          .filter(f => f.type === 'video/mp4')
          .sort((a, b) => (b.height || 0) - (a.height || 0));
        if (progressive.length > 0) {
          hlsUrl = progressive[0].link;
        }
      }

      if (!hlsUrl) {
        return new Response(`No playable URL found for video ${videoId}`, { status: 404 });
      }

      // 302 redirect to the fresh Vimeo URL
      return Response.redirect(hlsUrl, 302);

    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  }
};
