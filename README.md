# CloudWise - Cloud File Organizer

CloudWise is a full-stack cloud file management platform with AI-assisted categorization, secure transfer sessions, and an administrative console for governance and configuration.

## Key Capabilities
- S3-backed file storage with upload, download, and metadata management
- AI analysis and tagging workflows
- Secure transfer sessions with PIN verification and expiry controls
- Role-based access controls and admin-only operations
- Storage limits and platform settings managed via admin endpoints

## Architecture
- Backend: Spring Boot REST API, JWT authentication, PostgreSQL persistence
- Frontend: Vite + React single-page application
- Integrations: AWS S3 and Google Gemini API

## Repository Layout
- backend/  Spring Boot API, security, services, and database models
- frontend/ React UI, routing, services, and shared components

## Configuration
Environment variables are required for both services. Do not commit secrets.

Backend (backend/.env):
- DB_URL
- DB_USERNAME
- DB_PASSWORD
- SERVER_PORT
- APP_BASE_URL
- APP_CORS_ALLOWED_ORIGINS
- FRONTEND_URLS
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- AWS_S3_BUCKET_NAME
- GEMINI_API_KEY
- TRANSFER_PIN_ENCRYPTION_KEY
- RESEND_API_KEY
- RESEND_FROM

Frontend (frontend/.env):
- VITE_API_BASE_URL

## Local Development
Backend:
1) mvn spring-boot:run

Frontend:
1) npm install
2) npm run dev

## Admin Console
Admin routes are served under /admin and require the ADMIN role.

## Deployment Notes
- Set production origins in APP_CORS_ALLOWED_ORIGINS.
- Use secure secrets management for API keys and database credentials.
- Enable HTTPS in production environments.

## License
Proprietary - internal use only.
