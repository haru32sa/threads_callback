
const { google } = require("googleapis");

exports.handler = async function (event) {
  const { code, short_token, long_token, expires_in } = JSON.parse(event.body);

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const sheetId = process.env.SPREADSHEET_ID;
  const now = new Date().toISOString();

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "シート1!A2:E2",
      valueInputOption: "RAW",
      requestBody: {
        values: [[code, short_token, long_token, expires_in, now]],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Token logged successfully." }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
