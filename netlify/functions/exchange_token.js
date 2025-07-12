const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const redirect_uri = process.env.REDIRECT_URI; // これはトークン交換用のURIです
  const log_function_url = process.env.LOG_FUNCTION_URL;

  let code;

  // ★修正箇所: まずPOSTボディからコードを試みる
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      code = body.code;
      console.log('Code obtained from POST body.');
    } catch (e) {
      console.error('Error parsing POST request body:', e);
      // POSTボディのパースが予期せず失敗した場合のフォールバック
      code = event.queryStringParameters?.code;
      if (code) {
          console.warn('Code obtained from query string after POST body parse failure.');
      }
    }
  } else if (event.httpMethod === 'GET') { // ★GETリクエストの場合、クエリ文字列からコードを取得
    code = event.queryStringParameters?.code;
    console.log('Code obtained from GET query string.');
  } else {
    console.error('Unsupported HTTP Method or missing body for code acquisition.');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request: Expected GET (initial redirect) or POST (from callback.html).' }),
    };
  }

  // もしコードがまだ取得できていない場合
  if (!code) {
      console.error('認証コード（code）が取得できませんでした。');
      return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing authorization code.' }),
      };
  }

  console.log('client_id:', client_id ? '設定済み' : '未設定');
  console.log('client_secret:', client_secret ? '設定済み' : '未設定');
  console.log('redirect_uri (from env, for token exchange):', redirect_uri);
  console.log("📩 認証コード（code）:", code);

  if (!client_id || !client_secret || !redirect_uri) {
    console.error('環境変数が不足しています。');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Please check CLIENT_ID, CLIENT_SECRET, REDIRECT_URI.' }),
    };
  }

  // Threads APIの正しいトークンエンドポイント
  const token_url = 'https://graph.threads.net/oauth/access_token'; 

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirect_uri); // 環境変数から取得した正しいREDIRECT_URIを使用
  params.append('code', code);

  try {
    const response = await fetch(token_url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    console.log('Token response:', data);

    if (response.ok && data.access_token) { // response.okも確認する
      const log_function_url = process.env.LOG_FUNCTION_URL;
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
        statusCode: response.status || 500, // HTTPステータスコードを優先
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