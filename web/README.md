# SunProof web app

The home owner app (`/app`) and the installer app (`/pro`), built with React 19, Vite and TypeScript, hosted on AWS Amplify.

```bash
npm install
npm run dev        # http://localhost:5173, talks to the API in .env.development
npm run build      # production build in dist/
```

The API address comes from `VITE_API_URL` in `.env.development` and `.env.production`. Deploy with `../scripts/deploy_web.sh`. See the [main README](../README.md) for the backend and the demo.
