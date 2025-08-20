const BoxOAuth2Uploader = require('./box-upload');

/**
 * Example usage of the Box OAuth2 CSV Uploader
 * 
 * Make sure you have:
 * 1. Created the box-oauth2-uploader.js file
 * 2. Set your environment variables or update the constants below
 * 3. Have a CSV file to upload
 */

async function uploadExample() {
    try {
        console.log('🚀 Starting Box CSV Upload Example');
        console.log('==================================');

        // Your Box app credentials
        const CLIENT_ID = process.env.BOX_CLIENT_ID || 'replaceme';
        const CLIENT_SECRET = process.env.BOX_CLIENT_SECRET || 'andreplaceme';
        
        // File and folder settings
        const CSV_FILE_PATH = process.env.CSV_FILE_PATH || './testfile2.csv';
        const FOLDER_ID = process.env.BOX_FOLDER_ID || '0'; // '0' = root folder

        // Validate credentials
        if (CLIENT_ID === 'your_client_id_here' || CLIENT_SECRET === 'your_client_secret_here') {
            throw new Error('Please set your BOX_CLIENT_ID and BOX_CLIENT_SECRET environment variables');
        }

        // Create the uploader instance
        console.log('📦 Creating Box OAuth2 Uploader...');
        const uploader = new BoxOAuth2Uploader(CLIENT_ID, CLIENT_SECRET, {
            redirectUri: 'http://localhost:3000/callback',
            scope: 'root_readwrite',
            tokenFile: '.box_tokens.json'
        });

        // Check if we need to authenticate
        if (!uploader.accessToken) {
            console.log('🔐 No existing tokens found, starting authentication...');
            await uploader.authenticate();
        } else {
            console.log('✅ Using existing authentication tokens');
        }

        // Get current user info to verify authentication
        console.log('👤 Getting user info...');
        const user = await uploader.getCurrentUser();
        console.log(`👋 Authenticated as: ${user.name} (${user.login})`);

        // Upload the CSV file
        console.log('\n📁 Starting CSV upload...');
        const result = await uploader.uploadCSV(CSV_FILE_PATH, FOLDER_ID, {
            fileName: 'uploaded-data.csv', // Optional: rename the file
            preflightCheck: true,          // Optional: check before upload

        });

        // Display results
        console.log('\n🎉 Upload completed successfully!');
        console.log('================================');
        console.log(`📄 File Name: ${result.file.name}`);
        console.log(`🆔 File ID: ${result.file.id}`);
        console.log(`📊 File Size: ${result.file.size} bytes`);
        console.log(`⏱️  Upload Time: ${result.uploadTime} seconds`);
        console.log(`🔗 Box URL: https://app.box.com/files/0/f_${result.file.id}`);

    } catch (error) {
        console.error('\n❌ Upload failed:');
        console.error('=================');
        console.error(`Error: ${error.message}`);
        
        // Provide specific help based on error type
        if (error.message.includes('File not found')) {
            console.error('\n💡 Help: Make sure the CSV file exists at the specified path');
            console.error(`   Current path: ${process.env.CSV_FILE_PATH || './sample.csv'}`);
        } else if (error.message.includes('Authentication failed')) {
            console.error('\n💡 Help: Try deleting .box_tokens.json and re-authenticating');
        } else if (error.message.includes('redirect_uri_mismatch')) {
            console.error('\n💡 Help: Make sure your Box app has this redirect URI:');
            console.error('   http://localhost:3000/callback');
        }
        
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    uploadExample();
}

module.exports = uploadExample;