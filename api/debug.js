export const config = { runtime: 'edge' };

export default function handler() {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  const geminiKey = process.env.GEMINI_API_KEY;
  const sheetUrl = process.env.GOOGLE_SHEET_URL;

  return new Response(JSON.stringify({
    gemini_key_exists: !!geminiKey,
    google_sheet_url_exists: !!sheetUrl,
    gemini_key_length: geminiKey ? geminiKey.length : 0,
    google_sheet_url_preview: sheetUrl ? sheetUrl.substring(0, 15) + "..." : "none"
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
