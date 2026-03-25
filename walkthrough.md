# Walkthrough - Backend Setup Update

I have updated the backend setup instructions to include missing Prisma-related steps.

## Changes Made

### Documentation
- Updated [README.md](file:///d:/provenance_ai/README.md) to include:
  - Virtual environment activation for Windows.
  - Installation of the [prisma](file:///d:/provenance_ai/backend/prisma/schema.prisma) Python package.
  - Node.js dependency installation in the `backend` folder.
  - `prisma generate` command to create the Python database client.

## Final Instructions to Run the Backend

To run the backend server correctly, follow these steps from the root of the project:

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Activate the virtual environment**:
   ```bash
   .\.venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install prisma
   npm install
   ```

4. **Generate the Prisma client**:
   ```bash
   npx prisma generate
   ```

5. **Run the server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

The backend will then be available at [http://localhost:8000](http://localhost:8000).
Interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).
