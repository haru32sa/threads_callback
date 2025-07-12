const fetch = require("node-fetch");
const { google } = require("googleapis");

exports.handler = async function (event) {
  try {
    const { code } = JSON.parse(event.body);

    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
    const redirect_uri = process.env.REDIRECT_URI;

    console.log("🔵 STEP1: code 受け取り →", code);

    // ① 短期トークン取得
    const shortURL = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${client_secret}&code=${code}`;
    const shortRes = await fetch(shortURL);
    const shortData = await shortRes.json();

    console.log("🟢 STEP2: short_token 取得 →", shortData);

    const short_token = shortData.access_token;
    if (!short_token) throw new Error("short_token が取得できませんでした");

    // ② 長期トークンに交換
    const longURL = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${client_id}&client_secret=${client_secret}&fb_exchange_token=${short_token}`;
    const longRes = await fetch(longURL);
    const longData = await longRes.json();

    console.log("🟢 STEP3: long_token 取得 →", longData);

    const long_token = longData.access_token;
    const expires_in = longData.expires_in;

    if (!long_token || !expires_in) throw new Error("long_token 取得失敗");

    // ③ スプレッドシートに保存
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });
    const timestamp = new Date().toISOString();

    console.log("🟡 書き込みデータ →", [code, short_token, long_token, expires_in, timestamp]);

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
    console.error("❌ ERROR:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
