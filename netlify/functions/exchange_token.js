const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const redirect_uri = process.env.REDIRECT_URI;
  const code = event.queryStringParameters.code;

  // 🔍 デバッグログ（Cloud Logsで確認用）
  console.log('client_id:', client_id);
  console.log('client_secret:', client_secret);
  console.log('redirect_uri:', redirect_uri);
  console.log("📩 認証コード（code）:", code); // ★ここが超重要

  if (!client_id || !client_secret || !redirect_uri) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables' }),
    };
  }

  const token_url = 'https://api.instagram.com/oauth/access_token';
  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirect_uri);
  params.append('code', code);

  try {
    const response = await fetch(token_url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    // 🔍 成功ログ出力
    console.log('Token response:', data);

    if (data.access_token) {
      return {
        statusCode: 200,
        body: JSON.stringify(data),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to retrieve token', details: data }),
      };
    }
  } catch (error) {
    console.error('Error exchanging token:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Exception occurred', message: error.message }),
    };
  }
};
