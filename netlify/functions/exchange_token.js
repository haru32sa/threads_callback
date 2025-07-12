const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  // ★修正箇所: redirect_uri を callback.html のURLに直接変更 (環境変数からは取得しない)
  // または、このURIを初期認証時のリダイレクトURIと一致させる
  const redirect_uri_for_threads_api = 'https://gregarious-selkie-d66d75.netlify.app/callback.html'; 
  
  const log_function_url = process.env.LOG_FUNCTION_URL;

  let code;

  // `callback.html`からPOSTされるJSONボディから`code`を取得
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      code = body.code;
      console.log('Code obtained from POST body.');
    } catch (e) {
      console.error('Error parsing POST request body:', e);
      // Fallback to query string if body parsing fails unexpectedly for a POST
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
  // ★修正箇所: Threads APIに送信するredirect_uriをログ出力
  console.log('redirect_uri (sent to Threads API):', redirect_uri_for_threads_api); 
  console.log("📩 認証コード（code）:", code);

  if (!client_id || !client_secret) { // redirect_uri_for_threads_apiは直接定義したのでここでは不要
    console.error('環境変数が不足しています。');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Please check CLIENT_ID, CLIENT_SECRET.' }),
    };
  }

  const token_url = 'https://graph.threads.net/oauth/access_token'; 

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirect_uri_for_threads_api); // ★修正箇所: こちらを使用
  params.append('code', code);

  try {
    const response = await fetch(token_url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    console.log('Token response:', data);

    if (response.ok && data.access_token) {
      if (log_function_url) {
        try {
          await fetch(log_function_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              short_token: data.access_token,
              long_token: data.long_lived_token || null,
              expires_in: data.expires_in,
              user_id: data.user_id,
            }),
          });
          console.log('Token data sent to log_token function successfully.');
        } catch (logError) {
          console.error('Error sending token data to log_token function:', logError);
        }
      } else {
        console.warn('LOG_FUNCTION_URLが設定されていません。トークンのログ保存をスキップします。');
      }

      return {
        statusCode: 200,
        body: JSON.stringify(data),
      };
    } else {
      console.error('トークン取得失敗:', data);
      return {
        statusCode: response.status || 500,
        body: JSON.stringify(data),
      };
    }
  } catch (error) {
    console.error('トークン交換中にエラーが発生しました:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, details: 'Failed to exchange code for token.' }),
    };
  }
};