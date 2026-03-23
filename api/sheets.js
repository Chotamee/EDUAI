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
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    
    if (!sheetUrl) {
      return new Response(JSON.stringify({ error: "GOOGLE_SHEET_URL is not set in Vercel Environment Variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let requestBody = null;
    if (request.method === "POST") {
      requestBody = await request.arrayBuffer();
    }

    const response = await fetch(sheetUrl, {
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
