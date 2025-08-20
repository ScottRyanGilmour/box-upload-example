const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const axios = require('axios');

/**
 * Box.com CSV File Upload Script
 * 
 * This script uploads CSV files to Box.com using the Box Upload API.
 * Supports files up to 50MB (for larger files, chunked upload would be needed).
 */

class BoxUploader {
    constructor(accessToken) {
        if (!accessToken) {
            throw new Error('Access token is required');
        }
        this.accessToken = accessToken;
        this.uploadUrl = 'https://upload.box.com/api/2.0/files/content';
    }

    /**
     * Calculate SHA1 hash of file for integrity verification
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} SHA1 hash
     */
    async calculateSHA1(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Perform pre-flight check to validate upload before sending file
     * @param {string} fileName - Name of the file
     * @param {string} parentFolderId - Box folder ID where file will be uploaded
     * @param {number} fileSize - Size of the file in bytes
     * @returns {Promise<Object>} Pre-flight check result
     */
    async preflightCheck(fileName, parentFolderId, fileSize) {
        try {
            const response = await axios.options('https://api.box.com/2.0/files/content', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    name: fileName,
                    parent: { id: parentFolderId },
                    size: fileSize
                }
            });
            
            console.log('✅ Pre-flight check passed');
            return response.data;
        } catch (error) {
            if (error.response?.status === 409) {
                console.log('⚠️  File already exists - will upload as new version');
                return { conflict: true, conflicting_file: error.response.data };
            }
            throw new Error(`Pre-flight check failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Upload a CSV file to Box.com
     * @param {string} filePath - Local path to the CSV file
     * @param {string} parentFolderId - Box folder ID (use "0" for root folder)
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Upload result
     */
    async uploadCSV(filePath, parentFolderId = "0", options = {}) {
        try {
            // Validate file exists and is readable
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const stats = fs.statSync(filePath);
            const fileName = options.fileName || path.basename(filePath);
            const fileSize = stats.size;

            // Validate file size (50MB limit for direct upload)
            if (fileSize > 50 * 1024 * 1024) {
                throw new Error('File size exceeds 50MB limit. Use chunked upload for larger files.');
            }

            // Validate CSV file extension
            if (!fileName.toLowerCase().endsWith('.csv')) {
                console.log('⚠️  Warning: File does not have .csv extension');
            }

            console.log(`📁 Uploading: ${fileName}`);
            console.log(`📊 File size: ${(fileSize / 1024).toFixed(2)} KB`);
            console.log(`📂 Target folder ID: ${parentFolderId}`);

            // Perform pre-flight check
            if (options.preflightCheck !== false) {
                await this.preflightCheck(fileName, parentFolderId, fileSize);
            }

            // Calculate SHA1 hash for integrity verification
            const sha1Hash = await this.calculateSHA1(filePath);
            console.log(`🔐 SHA1 hash: ${sha1Hash}`);

            // Prepare multipart form data
            const form = new FormData();
            
            // Add attributes (must come before file)
            const attributes = {
                name: fileName,
                parent: { id: parentFolderId }
            };

            // Add optional timestamps
            if (options.contentCreatedAt) {
                attributes.content_created_at = options.contentCreatedAt;
            }
            if (options.contentModifiedAt) {
                attributes.content_modified_at = options.contentModifiedAt;
            }

            form.append('attributes', JSON.stringify(attributes));
            
            // Add file (must come after attributes)
            form.append('file', fs.createReadStream(filePath), {
                filename: fileName,
                contentType: 'text/csv'
            });

            // Prepare headers
            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-MD5': sha1Hash,
                ...form.getHeaders()
            };

            // Upload file
            console.log('🚀 Starting upload...');
            const startTime = Date.now();

            const response = await axios.post(this.uploadUrl, form, {
                headers,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 300000 // 5 minutes timeout
            });

            const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Upload completed in ${uploadTime}s`);

            const uploadedFile = response.data.entries[0];
            console.log(`📄 File uploaded successfully!`);
            console.log(`   File ID: ${uploadedFile.id}`);
            console.log(`   File Name: ${uploadedFile.name}`);
            console.log(`   File Size: ${uploadedFile.size} bytes`);
            console.log(`   Modified: ${uploadedFile.modified_at}`);

            return {
                success: true,
                file: uploadedFile,
                uploadTime: parseFloat(uploadTime)
            };

        } catch (error) {
            console.error('❌ Upload failed:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Please check your access token.');
            } else if (error.response?.status === 403) {
                throw new Error('Access forbidden. Please check your permissions.');
            } else if (error.response?.status === 409) {
                throw new Error('File already exists. Use updateFile() method or enable versioning.');
            } else if (error.response?.status === 413) {
                throw new Error('File too large. Maximum size is 50MB for direct upload.');
            }
            
            throw error;
        }
    }

    /**
     * Upload new version of existing file
     * @param {string} fileId - Box file ID to update
     * @param {string} filePath - Local path to the CSV file
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Upload result
     */
    async uploadNewVersion(fileId, filePath, options = {}) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileName = options.fileName || path.basename(filePath);
            const sha1Hash = await this.calculateSHA1(filePath);

            const form = new FormData();
            form.append('attributes', JSON.stringify({ name: fileName }));
            form.append('file', fs.createReadStream(filePath), {
                filename: fileName,
                contentType: 'text/csv'
            });

            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-MD5': sha1Hash,
                ...form.getHeaders()
            };

            if (options.ifMatch) {
                headers['If-Match'] = options.ifMatch;
            }

            console.log(`🔄 Uploading new version for file ID: ${fileId}`);
            
            const response = await axios.post(
                `https://upload.box.com/api/2.0/files/${fileId}/content`,
                form,
                { headers, timeout: 300000 }
            );

            const updatedFile = response.data.entries[0];
            console.log(`✅ New version uploaded successfully!`);
            console.log(`   File ID: ${updatedFile.id}`);
            console.log(`   Version: ${updatedFile.file_version.id}`);

            return { success: true, file: updatedFile };

        } catch (error) {
            console.error('❌ Version upload failed:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Export the class for use as a module
module.exports = BoxUploader;

