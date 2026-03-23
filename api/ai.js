export const config = { runtime: 'edge' };

export default async function handler(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Target-URL",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const targetUrl = request.headers.get("X-Target-URL") || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const aiUrl = new URL(targetUrl);
    
    // В Vercel Edge Functions переменные окружения доступны через process.env
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set in Vercel Environment Variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    aiUrl.searchParams.set("key", apiKey);

    // Читаем body запроса
    let requestBody = null;
    if (request.method === "POST") {
      requestBody = await request.arrayBuffer();
    }

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

  } catch (err) {
    console.error("Critical Worker Error:", err.stack || err.message);
    return new Response(JSON.stringify({ 
      error: "Internal Worker Error", 
      message: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
