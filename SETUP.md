# Setup

Requires Node.js >= 18 and pnpm (`npm install -g pnpm`).

```bash
git clone https://github.com/KNQuoc/haist.git
cd haist/workflow-editor
pnpm install
```

Create the env file:

```bash
cp apps/web/.env.example apps/web/.env
```

Edit `apps/web/.env` and add your API keys (at minimum `OPENAI_API_KEY`).

Run it:

```bash
pnpm dev
```

Open http://localhost:3000
