# Supabase Tasks App (React + Vite)

A simple task manager built with **React** and **Supabase** demonstrating:
- ✅ Supabase Auth (Signup/Login/Logout)
- ✅ PostgreSQL CRUD (Create, Read, Update, Delete tasks)
- ✅ Row Level Security (RLS) so each user only sees their own tasks
- ✅ Realtime updates (postgres_changes subscription)

## Tech Stack
- React + Vite
- Supabase (Auth, Postgres, RLS, Realtime)
- @supabase/supabase-js

## Features
- Signup/Login using Supabase Auth
- Add / list tasks
- Toggle done / delete task
- Per-user data protection using RLS policies (`user_id = auth.uid()`)

## Setup (Run Locally)

### 1) Install dependencies
```bash
npm install
