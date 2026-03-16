export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Target-URL",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Security Check: Ensure secrets are configured
    if (!env.GEMINI_API_KEY || !env.GOOGLE_SHEET_URL) {
      return new Response(JSON.stringify({ 
        error: "Secrets not configured in Cloudflare.",
        tip: "Add GEMINI_API_KEY and GOOGLE_SHEET_URL in Settings -> Variables -> Secrets"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const path = url.pathname.replace(/\/+$/, "");
      console.log(`Path: ${path}, Method: ${request.method}`);

      // 0. Base Path / Status
      if (path === "" || path === "/") {
        return new Response(JSON.stringify({ 
          status: "online", 
          message: "EduAI Proxy is ready.",
          endpoints: ["/ai", "/sheets", "/models", "/debug"]
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 1. Debug Endpoint
      if (path === "/debug") {
        return new Response(JSON.stringify({
          gemini_key_set: !!env.GEMINI_API_KEY,
          sheet_url_set: !!env.GOOGLE_SHEET_URL,
          sheet_url_preview: env.GOOGLE_SHEET_URL ? (env.GOOGLE_SHEET_URL.substring(0, 20) + "...") : "none",
          user_agent: request.headers.get("User-Agent")
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Buffer body for POST requests to handle redirects
      let requestBody = null;
      if (request.method === "POST") {
        requestBody = await request.arrayBuffer();
      }

      // 2. Proxy to AI (Gemini)
      if (path === "/ai") {
        const targetUrlStr = request.headers.get("X-Target-URL") || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
        const aiUrl = new URL(targetUrlStr);
        aiUrl.searchParams.set("key", env.GEMINI_API_KEY);

        const response = await fetch(aiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });

        // Copy body as text to avoid stream issues
        const responseData = await response.text();
        return new Response(responseData, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Proxy to Google Sheets
      if (path === "/sheets") {
        const response = await fetch(env.GOOGLE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: requestBody,
          redirect: "follow"
        });

        // Google Apps Script responses can be weird, so we read as text
        const responseData = await response.text();
        return new Response(responseData, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 4. Proxy to Models List
      if (path === "/models") {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
        const responseData = await response.text();
        return new Response(responseData, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Endpoint Not Found", { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error("Worker Error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
