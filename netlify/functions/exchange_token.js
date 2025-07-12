// netlify/functions/exchange_token.js
const fetch = require("node-fetch");
const { google } = require("googleapis");

exports.handler = async function (event) {
  try {
    const { code } = JSON.parse(event.body);

    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
    const redirect_uri = process.env.REDIRECT_URI;

    // --- ① 短期トークン取得 ---
    const tokenURL = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${client_secret}&code=${code}`;
    const shortRes = await fetch(tokenURL);
    const shortData = await shortRes.json();

    const short_token = shortData.access_token;

    // --- ② 長期トークンに交換 ---
    const longURL = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${client_id}&client_secret=${client_secret}&fb_exchange_token=${short_token}`;
    const longRes = await fetch(longURL);
    const longData = await longRes.json();
    const long_token = longData.access_token;
    const expires_in = longData.expires_in;

    // --- ③ Google Sheets に保存 ---
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "シート1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[code, short_token, long_token, expires_in, timestamp]],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        code,
        short_token,
        long_token,
        expires_in,
        timestamp,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
