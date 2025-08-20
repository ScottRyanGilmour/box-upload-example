const BoxUploader = require('./box-upload');

async function uploadFile() {
    const uploader = new BoxUploader('fake token');
    
    const result = await uploader.uploadCSV('./fakefile.csv', '0');
    console.log('Upload result:', result);
}

uploadFile();