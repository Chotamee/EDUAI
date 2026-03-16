export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Target-URL",
    };

    try {
      const url = new URL(request.url);
      // Normalize path: remove trailing slashes and ensure it starts with /
      let path = url.pathname.replace(/\/+$/, "");
      if (path === "") path = "/";

      console.log(`Request: ${request.method} ${path}`);

      // Handle CORS Preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // 1. Basic Health Check (Works even without Secrets)
      if (path === "/" || path === "/ping") {
        return new Response(JSON.stringify({ 
          status: "online", 
          message: "EduAI Proxy is active",
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Debugging Secrets (Check if keys are actually visible to the script)
      if (path === "/debug") {
        return new Response(JSON.stringify({
          gemini_key_exists: !!(env && env.GEMINI_API_KEY),
          google_sheet_url_exists: !!(env && env.GOOGLE_SHEET_URL),
          gemini_key_length: env?.GEMINI_API_KEY ? env.GEMINI_API_KEY.length : 0,
          google_sheet_url_preview: env?.GOOGLE_SHEET_URL ? env.GOOGLE_SHEET_URL.substring(0, 15) + "..." : "none"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Security Guard: Fail gracefully if secrets are missing
      if (!env || !env.GEMINI_API_KEY || !env.GOOGLE_SHEET_URL) {
        return new Response(JSON.stringify({ 
          error: "Cloudflare Workers Secrets are not properly configured.",
          manual: "Go to Workers -> eduai-proxy -> Settings -> Variables -> Secrets"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Buffer body for POST requests (prevents stream errors during redirects)
      let requestBody = null;
      if (request.method === "POST") {
        requestBody = await request.arrayBuffer();
      }

      // 4. Proxy Logic
      if (path === "/ai") {
        const targetUrl = request.headers.get("X-Target-URL") || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
        const aiUrl = new URL(targetUrl);
        aiUrl.searchParams.set("key", env.GEMINI_API_KEY);

        const response = await fetch(aiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });

        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } else if (path === "/sheets") {
        const response = await fetch(env.GOOGLE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: requestBody,
          redirect: "follow"
        });

        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } else if (path === "/models") {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Default: Not Found
      return new Response(JSON.stringify({ error: "Endpoint not found", path }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });

    } catch (err) {
      console.error("Critical Worker Error:", err.stack || err.message);
      return new Response(JSON.stringify({ 
        error: "Internal Worker Error", 
        message: err.message,
        stack: err.stack 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
