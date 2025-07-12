const fetch = require("node-fetch");
const { google } = require("googleapis");

exports.handler = async function (event, context) {
  try {
    const code = event.queryStringParameters.code;
    if (!code) {
      return { statusCode: 400, body: "Missing code parameter" };
    }

    // SHORTトークン取得
    const shortResp = await fetch("https://graph.facebook.com/v19.0/oauth/access_token?" +
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        code,
      }));
    const shortData = await shortResp.json();

    if (!shortData.access_token) {
      console.error("shortDataエラー:", shortData);
      throw new Error("短期アクセストークンの取得に失敗しました");
    }

    const short_token = shortData.access_token;

    // LONGトークン取得
    const longResp = await fetch("https://graph.facebook.com/v19.0/oauth/access_token?" +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        fb_exchange_token: short_token,
      }));
    const longData = await longResp.json();

    if (!longData.access_token || !longData.expires_in) {
      console.error("longDataエラー:", longData);
      throw new Error("長期アクセストークンの取得に失敗しました");
    }

    // Google Sheetsに保存
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const payload = {
      code,
      short_token,
      long_token: longData.access_token,
      expires_in: longData.expires_in,
      timestamp: new Date().toISOString(),
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "シート1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [Object.values(payload)],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "保存完了", payload }),
    };
  } catch (error) {
    console.error("token exchange error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
