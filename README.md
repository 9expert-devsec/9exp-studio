# 9Expert Studio

Internal web app for 9Expert Training, served at **studio.9expert.app**.

## Stack

- Next.js (App Router), JavaScript/JSX only (no TypeScript)
- React
- Tailwind CSS v4
- Lucide React (icons)
- Mongoose (MongoDB)
- ESLint
- npm

## Environment

Copy `.env.example` to `.env.local` and fill in the values. Never commit `.env.local`.

| Key               | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `MONGODB_URI`     | MongoDB connection string                     |
| `MONGODB_DB_NAME` | Database name (default `9exp_studio_db`)      |
| `AUTH_SECRET`     | Secret used to sign auth sessions             |

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts: `npm run lint`, `npm run build`, `npm start`.

## Branch model

- `main`: production
- `dev`: integration
- `staging` / `feature`: personal working branches, merged into `dev`
