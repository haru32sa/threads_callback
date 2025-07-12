
const fetch = require("node-fetch");

exports.handler = async function (event) {
  const { code } = JSON.parse(event.body);
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const redirect_uri = process.env.REDIRECT_URI;

  const tokenURL = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${client_secret}&code=${code}`;

  try {
    const shortRes = await fetch(tokenURL);
    const shortData = await shortRes.json();
    const short_token = shortData.access_token;

    const longURL = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${client_id}&client_secret=${client_secret}&fb_exchange_token=${short_token}`;
    const longRes = await fetch(longURL);
    const longData = await longRes.json();

    const payload = {
      code,
      short_token,
      long_token: longData.access_token,
      expires_in: longData.expires_in,
    };

    const logRes = await fetch(process.env.LOG_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      statusCode: 200,
      body: JSON.stringify(payload),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
