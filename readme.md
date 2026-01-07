# AI Pass

AI Pass is a credit-based AI tools web app (demo) for individuals and businesses.
It supports local login + Google OAuth, role-based dashboards, centralized credits, and usage logging.

## Features
- Auth: email/password + Google OAuth
- Roles: INDIVIDUAL, OWNER, ADMIN
- Credit-based usage (each tool run charges credits)
- Usage logs (success/fail)
- Pricing page with fake checkout that adds credits
- Owners can transfer credits to employees in their company
- Admin can assign users to companies

## Tech Stack
- Frontend: EJS + CSS + vanilla JS
- Backend: Node.js (Express) — ES Modules
- DB: PostgreSQL
- AI: Google Gemini API

## Local Setup
1) Install dependencies
```bash
npm install
