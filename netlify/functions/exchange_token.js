const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const redirect_uri_for_threads_api = 'https://gregarious-selkie-d66d75.netlify.app/callback.html'; 
  const log_function_url = process.env.LOG_FUNCTION_URL;

  let code;

  // 認証コードの取得ロジック（変更なし）
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      code = body.code;
      console.log('Code obtained from POST body.');
    } catch (e) {
      console.error('Error parsing POST request body:', e);
      code = event.queryStringParameters?.code;
      if (code) {
          console.warn('Code obtained from query string after POST body parse failure.');
      }
    }
  } else if (event.httpMethod === 'GET') {
    code = event.queryStringParameters?.code;
    console.log('Code obtained from GET query string.');
  } else {
    console.error('Unsupported HTTP Method or missing body for code acquisition.');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request: Expected GET (initial redirect) or POST (from callback.html).' }),
    };
  }

  if (!code) {
      console.error('認証コード（code）が取得できませんでした。');
      return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing authorization code.' }),
      };
  }

  console.log('client_id:', client_id ? '設定済み' : '未設定');
  console.log('client_secret:', client_secret ? '設定済み' : '未設定');
  console.log('redirect_uri (sent to Threads API):', redirect_uri_for_threads_api); 
  console.log("📩 認証コード（code）:", code);

  if (!client_id || !client_secret) {
    console.error('環境変数が不足しています。');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Please check CLIENT_ID, CLIENT_SECRET.' }),
    };
  }

  // ① 短期トークンの取得
  const shortTokenUrl = 'https://graph.threads.net/oauth/access_token'; 
  const shortTokenParams = new URLSearchParams();
  shortTokenParams.append('client_id', client_id);
  shortTokenParams.append('client_secret', client_secret);
  shortTokenParams.append('grant_type', 'authorization_code');
  shortTokenParams.append('redirect_uri', redirect_uri_for_threads_api);
  shortTokenParams.append('code', code);

  try {
    const shortTokenResponse = await fetch(shortTokenUrl, {
      method: 'POST',
      body: shortTokenParams,
    });

    const shortTokenData = await shortTokenResponse.json();

    console.log('Short Token response:', shortTokenData);

    if (shortTokenResponse.ok && shortTokenData.access_token) {
      const short_token = shortTokenData.access_token;
      let long_token = null; // 長期トークンを初期化
      let expires_in_long = null; // 長期トークンの期限を初期化

      // ② 長期トークンの取得 (オプション)
      // Threads APIの長期トークン交換エンドポイントはInstagramと異なる可能性があるので、
      // グラフAPIエクスプローラーの形式を参考にGETリクエストを使用します。
      const longTokenUrl = new URL('https://graph.threads.net/v1.0/access_token');
      longTokenUrl.searchParams.append('grant_type', 'th_exchange_token');
      longTokenUrl.searchParams.append('client_secret', client_secret);
      longTokenUrl.searchParams.append('access_token', short_token); // 取得した短期トークンを使用

      try {
        const longTokenResponse = await fetch(longTokenUrl.toString(), {
          method: 'GET', // GETリクエスト
        });

        const longTokenData = await longTokenResponse.json();
        console.log('Long Token response:', longTokenData);

        if (longTokenResponse.ok && longTokenData.access_token) {
          long_token = longTokenData.access_token;
          expires_in_long = longTokenData.expires_in; // 長期トークンのexpires_in
          console.log('Long-lived token obtained successfully.');
        } else {
          console.error('Failed to obtain long-lived token:', longTokenData);
        }
      } catch (longTokenError) {
        console.error('Error exchanging for long-lived token:', longTokenError);
      }

      // ログ関数に短期トークンと長期トークンの両方を送信
      if (log_function_url) {
        try {
          await fetch(log_function_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              short_token: short_token,
              long_token: long_token, // ここで取得した長期トークンを渡す
              expires_in: expires_in_long || shortTokenData.expires_in, // 長期トークンのexpires_inがあればそれを使用、なければ短期トークンのexpires_in
              user_id: shortTokenData.user_id,
            }),
          });
          console.log('Token data (short and long) sent to log_token function successfully.');
        } catch (logError) {
          console.error('Error sending token data to log_token function:', logError);
        }
      } else {
        console.warn('LOG_FUNCTION_URLが設定されていません。トークンのログ保存をスキップします。');
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          access_token: long_token || short_token, // 長期トークンがあればそれを返す、なければ短期トークン
          expires_in: expires_in_long || shortTokenData.expires_in,
          user_id: shortTokenData.user_id,
          message: long_token ? 'Short and long-lived tokens obtained.' : 'Only short-lived token obtained.'
        }),
      };
    } else {
      console.error('Failed to retrieve short-lived token:', shortTokenData);
      return {
        statusCode: shortTokenResponse.status || 500,
        body: JSON.stringify(shortTokenData),
      };
    }
  } catch (error) {
    console.error('Error in token exchange process:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, details: 'Failed to exchange code for token.' }),
    };
  }
};