const fetch = require('node-fetch');

exports.handler = async (event) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const redirect_uri = process.env.REDIRECT_URI;
  const log_function_url = process.env.LOG_FUNCTION_URL; // log_token.jsのURLを追加

  // ★修正箇所: event.body から code を取得する
  let code;
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body); // JSONボディをパース
      code = body.code;
    } catch (e) {
      console.error('Error parsing request body:', e);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body or missing code in body.' }),
      };
    }
  } else {
    // GETリクエストやボディがない場合のフォールバック（通常OAuthコールバックではPOSTを想定）
    code = event.queryStringParameters?.code;
  }

  // 🔍 デバッグログ（Cloud Logsで確認用）
  console.log('client_id:', client_id ? '設定済み' : '未設定');
  console.log('client_secret:', client_secret ? '設定済み' : '未設定');
  console.log('redirect_uri:', redirect_uri);
  console.log("📩 認証コード（code）:", code); // ★ここが超重要

  if (!client_id || !client_secret || !redirect_uri) {
    console.error('環境変数が不足しています。');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Please check CLIENT_ID, CLIENT_SECRET, REDIRECT_URI.' }),
    };
  }

  // ★重要: Threads APIのトークン取得エンドポイントを正確に確認し、変更してください。
  // 現在はInstagram Basic Display APIのエンドポイントになっています。
  // MetaのThreads APIドキュメントでOAuthフローを確認してください。
  const token_url = 'https://api.instagram.com/oauth/access_token'; 

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirect_uri);
  params.append('code', code); // ここで取得したcodeを使用

  try {
    const response = await fetch(token_url, {
      method: 'POST',
      body: params,
      // Instagram APIではContent-Type: application/x-www-form-urlencodedが自動で設定されるため不要な場合が多い
      // headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
    });

    const data = await response.json();

    // 🔍 成功ログ出力
    console.log('Token response:', data);

    if (data.access_token) {
      // ★ログ保存FunctionへのPOST処理を追加
      if (log_function_url) {
        try {
          await fetch(log_function_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code, // 元の認証コード
              short_token: data.access_token, // short-lived token
              long_token: data.long_lived_token || null, // long-lived tokenがあれば（Threads APIによる）
              expires_in: data.expires_in, // トークンの有効期限
            }),
          });
          console.log('Token data sent to log_token function successfully.');
        } catch (logError) {
          console.error('Error sending token data to log_token function:', logError);
          // ログ保存失敗は本処理の成功に影響しないが、エラーとして記録
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
        statusCode: data.code || 500, // APIからのエラーコードがあればそれを使用
        body: JSON.stringify(data), // エラーレスポンスをそのまま返す
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