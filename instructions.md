# Cloudflare Worker Setup Guide

Follow these steps to set up your secure proxy and fix the "Test Bank" error.

## Step 1: Create a Cloudflare Account
If you don't have one, sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up).

## Step 2: Create a New Worker
1. Go to **Workers & Pages** in the sidebar.
2. Click **Create Application** -> **Create Worker**.
3. Name it (e.g., `eduai-proxy`) and click **Deploy**.

## Step 4: Insert the Proxy Code
1. Click **Edit Code** in your new Worker.
2. Delete everything inside and paste the contents of the `worker.js` file from your project folder.
3. Click **Save and Deploy**.

## Step 5: Add Your Secret Keys
For security, we don't put keys in the code. We put them in "Secrets":
1. Go back to your Worker's main page.
2. Select **Settings** tab -> **Variables**.
3. Under **Secrets**, click **Add variable** for both:
   - **GEMINI_API_KEY**: `AIzaSyBQLZDGkyB4Z77t22uK2zOmnRsUPl6eZS0`
   - **GOOGLE_SHEET_URL**: `https://script.google.com/macros/s/AKfycbztNCzTA-nwomQ6_yga7XdhrkByC21HIITsBOUTxKol4lzJ9PyQouEuTqtTm282ahJ8/exec`
4. Click **Save and Deploy**.

## Step 6: Update Your Website
1. Copy your Worker's URL (it looks like `https://eduai-proxy.your-name.workers.dev`).
2. Open `config.js` in your project.
3. Paste the URL into `WORKER_URL`:
   ```javascript
   window.CONFIG = {
       WORKER_URL: "https://your-worker-url-here.workers.dev"
   };
   ```
4. Save the file.

## Step 7: Final Push
Now that your frontend code is updated to use the Worker, you can push everything to GitHub:
```bash
git add .
git commit -m "Switch to Cloudflare Worker proxy for security"
git push origin main
```
