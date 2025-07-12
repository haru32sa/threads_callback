const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  // ★修正箇所: 環境変数から取得したREDIRECT_URIを使用
  // このREDIRECT_URIはMeta Developer Consoleに登録されているものと一致する必要があります
  const redirect_uri = process.env.REDIRECT_URI;
  
  let code;
  // `callback.html`からPOSTされるJSONボディから`code`を取得
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      code = body.code;
    } catch (e) {
      console.error('Error parsing request body for code:', e);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body or missing code in body.' }),
      };
    }
  } else {
      // 想定外のメソッドまたはボディ形式の場合のエラーハンドリング
      console.error('Unsupported HTTP Method or missing body for code acquisition.');
      return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Bad Request: Expected POST with JSON body.' }),
      };
  }

  console.log('client_id:', client_id ? '設定済み' : '未設定');
  console.log('client_secret:', client_secret ? '設定済み' : '未設定');
  console.log('redirect_uri (from env):', redirect_uri); // 環境変数からのredirect_uriをログ出力
  console.log("📩 認証コード（code）:", code);

  if (!client_id || !client_secret || !redirect_uri) {
    console.error('環境変数が不足しています。');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Please check CLIENT_ID, CLIENT_SECRET, REDIRECT_URI.' }),
    };
  }

  // ★修正箇所: Threads APIの正しいトークンエンドポイントに更新
  const token_url = 'https://graph.threads.net/oauth/access_token'; 

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirect_uri); // ★環境変数から取得した正しいREDIRECT_URIを使用
  params.append('code', code);

  try {
    const response = await fetch(token_url, {
      method: 'POST',
      body: params,
      // Threads APIのドキュメントに明示されていない限り、Content-Typeは通常不要
      // -F オプション (curl) は multipart/form-data または application/x-www-form-urlencoded を意味しますが
      // node-fetchのURLSearchParamsは自動的に application/x-www-form-urlencoded を設定します。
    });

    const data = await response.json();

    console.log('Token response:', data);

    if (data.access_token) {
      const log_function_url = process.env.LOG_FUNCTION_URL;
      if (log_function_url) {
        try {
          await fetch(log_function_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              short_token: data.access_token,
              long_token: data.long_lived_token || null, // Threads APIがlong_lived_tokenを返すか確認
              expires_in: data.expires_in,
              user_id: data.user_id, // Threads APIはuser_idも返す
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
        statusCode: data.code || 500,
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