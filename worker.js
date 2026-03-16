export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Helper for CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/ai") {
        // --- Proxy to Gemini AI ---
        const aiUrl = new URL(request.headers.get("X-Target-URL") || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent");
        aiUrl.searchParams.set("key", env.GEMINI_API_KEY);

        const newRequest = new Request(aiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: request.body,
        });

        const response = await fetch(newRequest);
        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;

      } else if (url.pathname === "/sheets") {
        // --- Proxy to Google Sheets ---
        const sheetUrl = env.GOOGLE_SHEET_URL;
        
        const newRequest = new Request(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: request.body,
        });

        const response = await fetch(newRequest);
        // Google Script usually redirects, but CF Worker fetch handles redirects by default.
        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;

      } else if (url.pathname === "/models") {
        // --- Proxy to Get Models List ---
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(modelsUrl);
        const newResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach(h => newResponse.headers.set(h, corsHeaders[h]));
        return newResponse;
      }

      return new Response("Not Found", { status: 404 });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};
