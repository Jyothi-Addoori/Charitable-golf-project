# Digital Heroes — React + Supabase

A working Level-1 implementation of the supplied Digital Heroes PRD.

## Stack
- React + Vite
- Supabase Auth + PostgreSQL + Storage
- Vercel-ready static deployment
- Stripe-ready subscription boundary (payment credentials are intentionally not hard-coded)

## Local setup
1. `npm install`
2. Create a Supabase project.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Copy `.env.example` to `.env` and add your Supabase URL + publishable key.
5. `npm run dev`

## First admin
Register a user, then run:
`update public.profiles set role='admin' where email='YOUR_EMAIL';`

## Vercel
Import this repository, set the same `VITE_` variables in Project Settings → Environment Variables, then deploy.

## Important
The browser must only use the Supabase publishable key. Never expose a Supabase secret/service-role key.
Stripe payments require a server-side/Supabase Edge Function with secret Stripe credentials. The UI includes a payment-ready subscription flow but does not pretend a payment was completed without Stripe.
