# ExpenseFlow — Public Landing Page

This is the public marketing landing page for **ExpenseFlow**, built with Next.js 14 App Router.

## Stack

- **Next.js 14** — App Router with Server Components
- **TypeScript**
- **Tailwind CSS**
- **next-themes** — dark/light mode without flash
- **lucide-react** — icons

## Features

- Server-rendered with **ISR** (Incremental Static Regeneration, 1-hour revalidation)
- Live stats fetched from the ExpenseFlow API at build/revalidation time
- Dark/light theme toggle
- Responsive design

## Structure

```
landing/
├── app/
│   ├── components/
│   │   ├── Providers.tsx      # ThemeProvider wrapper
│   │   └── ThemeToggle.tsx    # Dark/light toggle button
│   ├── globals.css
│   ├── layout.tsx             # Root layout with metadata
│   └── page.tsx               # Main landing page (Server Component + ISR)
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## Development

```bash
cd landing
npm install
npm run dev       # http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://your-api.vercel.app
```

Defaults to `http://localhost:5001` for the API and `http://localhost:5173` for the app.

## Deployment

Deploy as a separate Vercel project pointing to the `landing/` directory as the root.
