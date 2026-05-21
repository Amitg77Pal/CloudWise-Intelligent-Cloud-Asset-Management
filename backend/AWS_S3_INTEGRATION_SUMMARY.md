# AWS S3 Cloud Storage Integration - Phase 2

## Overview
This document summarizes the AWS S3 integration implementation for CloudWise AI backend.

## Implementation Summary

### 1. Dependencies Added
- **AWS SDK for Java v2** (`software.amazon.awssdk:s3:2.20.26`) added to `pom.xml`

### 2. Database Model
- **FileMetadata Entity** (`backend/src/main/java/com/cloudfileorganizer/backend/model/FileMetadata.java`)
  - Stores file metadata in PostgreSQL
  - Fields: `id`, `name`, `originalName`, `size`, `mimeType`, `s3Key`, `bucketName`, `category`, `uploadDate`, `user`
  - Relationship: Many-to-One with `User` entity

### 3. Repository Layer
- **FileRepository** (`backend/src/main/java/com/cloudfileorganizer/backend/repository/FileRepository.java`)
  - JPA repository for file operations
  - Methods: `findByUser`, `findByIdAndUser`, `findByUserAndCategory`

### 4. AWS Configuration
- **AwsS3Config** (`backend/src/main/java/com/cloudfileorganizer/backend/config/AwsS3Config.java`)
  - Configures `S3Client` bean with IAM credentials
  - Reads credentials from `application.properties`

### 5. S3 Service Layer
- **S3Service** (`backend/src/main/java/com/cloudfileorganizer/backend/service/S3Service.java`)
  - `uploadFile()`: Uploads files to S3 with server-side encryption (AES256)
  - `generatePresignedUrl()`: Generates time-limited signed URLs (default 60 minutes)
  - `deleteFile()`: Deletes files from S3
  - `fileExists()`: Checks file existence
  - `getContentType()`: Retrieves file content type

### 6. File Service Layer
- **FileService** (`backend/src/main/java/com/cloudfileorganizer/backend/service/FileService.java`)
  - Orchestrates file operations (upload, retrieve, delete)
  - Validates files (size limit: 100MB)
  - Normalizes categories: `academic`, `finance`, `resume`, `images`, `others`
  - Ensures user-restricted access

### 7. Controller Layer
- **FileController** (`backend/src/main/java/com/cloudfileorganizer/backend/controller/FileController.java`)
  - `POST /api/files/upload`: Upload file to S3
  - `GET /api/files`: List user's files (with optional category filter)
  - `GET /api/files/{id}`: Get file metadata
  - `GET /api/files/{id}/download`: Generate pre-signed download URL
  - `DELETE /api/files/{id}`: Delete file from S3 and database

### 8. Security Configuration
- **JwtAuthenticationFilter** (`backend/src/main/java/com/cloudfileorganizer/backend/security/JwtAuthenticationFilter.java`)
  - Filters requests and validates JWT tokens
  - Extracts user from token and sets authentication context

- **SecurityConfig** (`backend/src/main/java/com/cloudfileorganizer/backend/security/SecurityConfig.java`)
  - Updated to use JWT authentication filter
  - Stateless session management
  - Protected routes require authentication

- **JwtUtil** (`backend/src/main/java/com/cloudfileorganizer/backend/security/JwtUtil.java`)
  - Enhanced with `extractEmail()` and `validateToken()` methods

### 9. Configuration Properties
- **application.properties** updated with AWS configuration:
  ```properties
  aws.access-key-id=${AWS_ACCESS_KEY_ID:your-access-key-id}
  aws.secret-access-key=${AWS_SECRET_ACCESS_KEY:your-secret-access-key}
  aws.region=${AWS_REGION:us-east-1}
  aws.s3.bucket-name=${AWS_S3_BUCKET_NAME:cloudvault-ai-files}
  aws.s3.url-expiration-minutes=60
  ```

## File Upload Flow

1. **Client Request**: Frontend sends `POST /api/files/upload` with `MultipartFile` and optional `category`
2. **Authentication**: JWT filter validates token and extracts `User`
3. **Validation**: `FileService` validates file (not empty, size < 100MB)
4. **Category Normalization**: Category is normalized to one of: `academic`, `finance`, `resume`, `images`, `others`
5. **S3 Upload**: `S3Service` uploads file to S3 with:
   - Key format: `{category}/{userId}/{uuid}.{extension}`
   - Server-side encryption (AES256)
   - Metadata (original filename, uploaded-by, category)
6. **Database Save**: File metadata saved to PostgreSQL with `s3Key` and `bucketName`
7. **Response**: Returns file metadata (id, name, size, category, uploadDate, mimeType)

## File Retrieval Flow

1. **Client Request**: Frontend sends `GET /api/files/{id}/download`
2. **Authentication**: JWT filter validates token
3. **Authorization**: `FileService` verifies file belongs to authenticated user
4. **S3 URL Generation**: `S3Service` generates pre-signed URL (expires in 60 minutes)
5. **Response**: Returns JSON with `downloadUrl` containing the pre-signed URL

## File Organization in S3

Files are organized by category folders:
```
bucket-name/
├── academic/
│   └── {userId}/
│       └── {uuid}.{ext}
├── finance/
│   └── {userId}/
│       └── {uuid}.{ext}
├── resume/
│   └── {userId}/
│       └── {uuid}.{ext}
├── images/
│   └── {userId}/
│       └── {uuid}.{ext}
└── others/
    └── {userId}/
        └── {uuid}.{ext}
```

## Security Features

1. **Private S3 Bucket**: All buckets are private (no public access)
2. **Server-Side Encryption**: AES256 encryption enabled on all uploads
3. **User-Restricted Access**: Users can only access their own files
4. **JWT Authentication**: All endpoints require valid JWT token
5. **Pre-Signed URLs**: Time-limited URLs (60 minutes default) for downloads
6. **IAM Credentials**: AWS credentials stored in environment variables or `application.properties`

## Setup Instructions

### 1. AWS Setup
1. Create an S3 bucket (e.g., `cloudvault-ai-files`)
2. Ensure bucket is **private** (block all public access)
3. Create IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:HeadObject"
         ],
         "Resource": "arn:aws:s3:::cloudvault-ai-files/*"
       }
     ]
   }
   ```
4. Generate access key and secret key for the IAM user

### 2. Environment Variables (Recommended)
Set these environment variables:
```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
export AWS_S3_BUCKET_NAME=cloudvault-ai-files
```

### 3. Application Properties (Alternative)
If not using environment variables, update `application.properties`:
```properties
aws.access-key-id=your-access-key-id
aws.secret-access-key=your-secret-access-key
aws.region=us-east-1
aws.s3.bucket-name=cloudvault-ai-files
```

### 4. Database Migration
The `FileMetadata` entity will be automatically created by Hibernate (`spring.jpa.hibernate.ddl-auto=update`).

## API Endpoints

### Upload File
```
POST /api/files/upload
Headers: Authorization: Bearer {jwt_token}
Body: multipart/form-data
  - file: File
  - category: String (optional)
Response: {
  "id": 1,
  "name": "document.pdf",
  "size": 1024,
  "category": "academic",
  "uploadDate": "2026-01-26T10:00:00",
  "mimeType": "application/pdf"
}
```

### List Files
```
GET /api/files?category=academic (optional)
Headers: Authorization: Bearer {jwt_token}
Response: [
  {
    "id": 1,
    "name": "document.pdf",
    "size": 1024,
    "category": "academic",
    "uploadDate": "2026-01-26T10:00:00",
    "mimeType": "application/pdf"
  }
]
```

### Get File Details
```
GET /api/files/{id}
Headers: Authorization: Bearer {jwt_token}
Response: {
  "id": 1,
  "name": "document.pdf",
  "size": 1024,
  "category": "academic",
  "uploadDate": "2026-01-26T10:00:00",
  "mimeType": "application/pdf"
}
```

### Download File
```
GET /api/files/{id}/download
Headers: Authorization: Bearer {jwt_token}
Response: {
  "downloadUrl": "https://s3.amazonaws.com/bucket/key?signature=..."
}
```

### Delete File
```
DELETE /api/files/{id}
Headers: Authorization: Bearer {jwt_token}
Response: {
  "message": "File deleted successfully"
}
```

## Testing

1. **Start Backend**: `mvn spring-boot:run`
2. **Verify AWS Connection**: Check logs for S3 client initialization
3. **Test Upload**: Use Postman or frontend to upload a file
4. **Verify S3**: Check AWS S3 console to see uploaded file
5. **Test Download**: Generate download URL and verify it works
6. **Test Delete**: Delete file and verify removal from S3 and database

## Transfer Feature S3 CORS (Required)

The secure transfer flow uploads directly from browser to S3 using a pre-signed `PUT` URL.
If bucket CORS is missing, browser upload fails with network/CORS errors even when backend APIs are healthy.

Apply a bucket CORS configuration similar to:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "x-amz-*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Minimum requirements for transfer upload CORS:
- Allow the frontend origin exactly.
- Allow `PUT`, `GET`, and `HEAD` methods. Do not list `OPTIONS` explicitly; S3 handles preflight for allowed methods.
- Allow `Content-Type` and `x-amz-*` request headers.

HTTP 403 troubleshooting for direct pre-signed uploads:
- Ensure pre-signed URL expiry is long enough (default is now 3600 seconds).
- Ensure IAM principal used by backend signing has `s3:PutObject` permission on the target object prefix.
- Ensure browser `Content-Type` matches the signed header exactly.
- Do not include `x-amz-acl`/ACL params when S3 Block Public Access is enabled.
- Ensure S3 client/presigner region matches the bucket region.

Note on auto-delete messaging:
- UI shows auto-delete time from backend session expiry.
- Actual S3 object deletion is performed by backend cleanup scheduler at/after expiry.

## Notes

- **Frontend Compatibility**: All endpoints match the existing frontend API contract
- **No Frontend Changes Required**: Frontend continues to work as-is
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
- **File Size Limit**: 100MB maximum file size (configurable in `FileService`)
- **URL Expiration**: Pre-signed URLs expire after 60 minutes (configurable)

