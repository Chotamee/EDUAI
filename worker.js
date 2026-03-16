export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Target-URL",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!env.GEMINI_API_KEY || !env.GOOGLE_SHEET_URL) {
      return new Response(JSON.stringify({ error: "Cloudflare Secrets not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const path = url.pathname.replace(/\/+$/, ""); // Remove trailing slash
      console.log(`Matching path: "${path}"`);

      // 1. Welcome / Status check
      if (path === "" || path === "/") {
        return new Response(JSON.stringify({ 
          status: "online", 
          message: "EduAI API Proxy is running.",
          key_configured: !!env.GEMINI_API_KEY,
          sheet_configured: !!env.GOOGLE_SHEET_URL
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Buffer the body for POST requests
      let body = null;
      if (request.method === "POST") {
        body = await request.arrayBuffer();
      }

      // 2. Proxy to AI (Gemini)
      if (path === "/ai") {
        const targetUrlStr = request.headers.get("X-Target-URL") || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
        const aiUrl = new URL(targetUrlStr);
        aiUrl.searchParams.set("key", env.GEMINI_API_KEY);

        console.log(`Proxying AI to: ${aiUrl.toString().split('key=')[0]}...`);

        const response = await fetch(aiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
        });

        // If Gemini returns an error, we want to know what it is
        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;
      }

      // 3. Proxy to Google Sheets
      if (path === "/sheets") {
        console.log("Proxying to Sheets...");
        const response = await fetch(env.GOOGLE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: body,
          redirect: "follow"
        });

        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;
      }

      // 4. Proxy to Models List
      if (path === "/models") {
        // Try v1 for models list as it's more stable
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${env.GEMINI_API_KEY}`);
        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
