// googleDrive.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';

const credentials = require('./credentials.json');
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

oAuth2Client.setCredentials(require('./token.json'));

const drive = google.drive({ version: 'v3', auth: oAuth2Client });

async function uploadFile(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // ID папки в Google Drive
  };
  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  return response.data;
}

module.exports = { uploadFile };
