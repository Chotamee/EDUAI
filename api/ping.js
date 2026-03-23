export const config = { runtime: 'edge' };

export default function handler() {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  return new Response(JSON.stringify({ 
    status: "online", 
    message: "EduAI Vercel Proxy is active",
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
