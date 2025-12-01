# Redact App

A secure desktop application for redacting sensitive information from PDFs.

## Features
- Drag and drop PDF upload
- Real-time PDF preview
- Text-based redaction
- Secure local processing
- Support for password-protected PDFs

## Development

### Prerequisites
- Node.js
- Python 3.9+

### Setup
1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Install backend dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

### Running
```bash
npm run dev
```

### Building
```bash
npm run dist
```
