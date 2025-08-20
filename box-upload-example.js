const BoxOAuth2Uploader = require('./box-upload');

async function uploadWithOAuth2() {
    // Initialize with your OAuth2 credentials
    const uploader = new BoxOAuth2Uploader(
        'sxvi5yoqwb08g4al7tbntjkxo2reauf7', 
        'AnuWEfHtQ3LZpU9FnEwce1b7pq1ZCZgn'
    );
    
    // First time: this will open browser for authentication
    if (!uploader.accessToken) {
        await uploader.authenticate();
    }
    
    // Upload CSV file
    const result = await uploader.uploadCSV('./testfile2.csv', '0');
    console.log('Upload result:', result);
}

uploadWithOAuth2();