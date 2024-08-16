const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.urlencoded({ extended: true }));

const oauth2Client = new google.auth.OAuth2(
  '${process.env["GOOGLE_CLIENT_ID"]}',
  '${process.env["GOOGLE_CLIENT_SECRET"]}',
  'http://localhost:3000/oauth2callback'
);

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets'];

app.get('/', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.send(`<a href="${authUrl}">Authorize app</a>`);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    res.redirect('/select-sheet');
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/select-sheet', async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
    });

    const sheets = response.data.files;
    let html = '<h1>Select a Google Sheet</h1><form action="/process-sheet" method="post"><select name="sheetId">';
    sheets.forEach(sheet => {
      html += `<option value="${sheet.id}">${sheet.name}</option>`;
    });
    html += '</select><br><br><input type="submit" value="Select Sheet"></form>';

    res.send(html);
  } catch (error) {
    console.error('Error listing sheets', error);
    res.status(500).send('Error retrieving sheets list');
  }
});

app.post('/process-sheet', async (req, res) => {
  const sheetId = req.body.sheetId;
  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties.title',
    });

    let html = '<h1>Sheets in the selected spreadsheet:</h1><ul>';
    response.data.sheets.forEach((sheet) => {
      html += `<li>${sheet.properties.title}</li>`;
    });
    html += '</ul>';
    html += '<p>Spreadsheet ID: ' + sheetId + '</p>';
    html += '<p>You can now use this ID in your application to interact with this specific sheet.</p>';

    res.send(html);
  } catch (error) {
    console.error('Error retrieving sheet details', error);
    res.status(500).send('Error processing the selected sheet');
  }
});

const server = app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});