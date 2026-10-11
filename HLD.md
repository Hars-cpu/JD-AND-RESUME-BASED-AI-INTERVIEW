# High-Level Design (HLD)

## 1. System Overview

CodeSangram is an advanced MERN stack application offering dual functionality: a competitive coding platform and an AI-powered Interview Copilot. The system is designed to provide real-time code evaluation using Judge0 and simulate interactive voice-based behavioral and technical interviews using Google Gemini Flash 2.0.

### 1.1 Core Components

*   **Frontend (Client)**: React 19 (Vite) Single Page Application (SPA).
*   **Backend (API Server)**: Node.js with Express.
*   **Database**: MongoDB Atlas.
*   **Cache / Session Store**: Redis (upstash/cloud).
*   **Code Execution Engine**: Self-hosted Judge0.
*   **Storage (Media/Docs)**: Cloudinary.
*   **AI Engine**: Google Gemini API.

---

## 2. Architecture Diagram

```mermaid
graph TD
    Client[Web Browser Client] -->|HTTPS / REST| CDN[Vercel CDN]
    CDN --> FE[React SPA Frontend]
    FE -->|API Requests| Render[Render Web Service / Node.js]
    
    subgraph Backend Architecture
        Render --> Controllers
        Controllers --> Services
        Services --> Models
        
        %% External Integrations
        Services -->|Code Evaluation| Judge0[Self-hosted Judge0]
        Services -->|GenAI Prompts| Gemini[Google Gemini 2.0 Flash]
        Services -->|Video/PDF Upload| Cloudinary[Cloudinary]
    end
    
    subgraph Data Layer
        Models -->|Read/Write| MongoDB[(MongoDB Atlas)]
        Render -->|Token Blacklist| Redis[(Redis)]
    end
```

---

## 3. Key Workflows & Subsystems

### 3.1 Authentication Flow
1.  **Login/Register**: User submits credentials to the `/auth` endpoints.
2.  **JWT Issue**: Backend hashes password (bcrypt), signs a JWT (1h expiration), and sets it as an `HttpOnly`, `Secure` cookie.
3.  **Validation**: `userMiddleware` intercepts requests, extracts the cookie, validates the JWT, and checks if the token is in the Redis Blacklist (for logged-out users).

### 3.2 Code Execution (Judge0)
1.  **Submission**: User writes code in the Monaco Editor and submits.
2.  **Batching**: Backend maps visible/hidden test cases and creates a batch request to Judge0.
3.  **Evaluation**: Judge0 runs the code securely in sandboxes and returns tokens.
4.  **Result Polling**: Backend requests results from Judge0 using tokens, compares stdout with expected output, and stores a `Submission` record in MongoDB.

### 3.3 AI Interview Copilot (Voice & Text)
1.  **Resume & JD Upload**: PDFs are uploaded to Cloudinary. Gemini reads the Cloudinary PDF URL to generate an `InterviewReport` context.
2.  **Voice Loop**:
    *   **Speech Recognition**: Browser uses `SpeechRecognition` (Web Speech API) to transcribe user speech to text.
    *   **Inference**: Text is sent to the backend `/generate-followup`. Gemini uses conversational memory (prior Q&A context) to generate a response.
    *   **Speech Synthesis**: The backend returns text, which the browser reads aloud using `SpeechSynthesis`.
3.  **Scorecard Generation**: At the end of the session, the backend compiles all Q&A into a prompt. Gemini outputs structured JSON (validated via JSON Schema) evaluating strengths, weaknesses, and a hire recommendation.

### 3.4 Dashboards & Analytics
1.  **Aggregation**: The dashboard aggregates data from `Submission`, `InterviewReport`, and `InterviewSession` collections.
2.  **Heatmap Generation**: User activity (Submissions and completed interviews) is converted into an activity map grouped by UTC dates, rendering GitHub-style contribution graphs.

---

## 4. Scalability & Deployment Strategy

*   **Frontend**: Deployed on **Vercel** to utilize Edge caching and fast CDN delivery for static assets (React bundle).
*   **Backend**: Deployed on **Render** (Node Web Service). Horizontally scalable. State is kept outside the Node process (MongoDB for data, Redis for session invalidation).
*   **Database**: **MongoDB Atlas** handles replica sets automatically for high availability and failover.
*   **Media**: **Cloudinary** offloads bandwidth constraints for video editorials and resumes, saving server storage and network I/O.
