# Self Review AI

> 🤖 **Local AI-assisted self-review generator for software engineers**

Generate calibration-grade performance reviews from your merged PRs — completely local, private, and evidence-based.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)

---
## 🔥 Demo

![Demo](https://drive.google.com/file/d/1D7e-rqsXayARoV6GDjh2TZ53u7XY56Jb/view?usp=sharing)

---

## ✨ Features

- **100% Local** — All data stays on your machine. No cloud APIs.
- **Evidence-Based** — Reviews are grounded in actual PR data, not vibes.
- **Jira Integration** — Automatically fetches linked ticket context.
- **Career Framework Alignment** — Maps your work to competency expectations.
- **Calibration-Safe Output** — Professional, defensible review language.
- **Web UI** — Beautiful interface to configure, run, and view reviews.
- **Data Transparency** — View raw data at every pipeline stage.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web UI (Next.js)                         │
│   Setup Page → Progress → Review Display → Data Viewer          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Pipeline                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Crawler  │→ │ Parser   │→ │Summarizer│→ │Synthesizer│       │
│  │(Playwright)│ │          │  │ (Ollama) │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Output Files                              │
│  raw.json → processed.json → alignment.json → self-review.json  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### 1. Node.js (v18+)

```bash
# Check version
node --version  # Should be >= 18.0.0

# Install via nvm (recommended)
nvm install 18
nvm use 18
```

### 2. Ollama (Local LLM)

Ollama runs the local language model for summarization.

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### 3. Pull Required Models

After installing Ollama, pull the required model:

```bash
# Start Ollama service (runs in background)
ollama serve

# In another terminal, pull the model
ollama pull qwen2.5:7b

# Verify it's installed
ollama list
```

**Model Options:**

| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| `qwen2.5:7b` | ~4.5GB | ⭐⭐⭐⭐⭐ | Medium |
| `llama3.2:3b` | ~2GB | ⭐⭐⭐ | Fast |
| `mistral:7b` | ~4GB | ⭐⭐⭐⭐ | Medium |

**Recommended:** `qwen2.5:7b` for best instruction-following and structured output.

### 4. Google Chrome

The pipeline uses Playwright with a persistent Chrome profile for authentication.

```bash
# macOS - Chrome is usually at:
/Applications/Google Chrome.app

# Verify Chrome is installed
which google-chrome || echo "Chrome found at default location"
```

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/self-review-ai.git
cd self-review-ai
```

### Step 2: Install Dependencies

```bash
# Install main project dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Install web UI dependencies
cd web
npm install
cd ..
```

### Step 3: Verify Ollama is Running

```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# If not running, start it:
ollama serve
```

---

## 🔐 First-Time Setup: SSO Authentication

The pipeline needs to access your company's internal tools (Harness Code, Jira). You'll do a one-time manual login that gets saved to a persistent Chrome profile.

### Step 1: Run the Login Script

```bash
npm run login
```

This opens a Chrome window. **Do NOT close it.**

### Step 2: Complete SSO Login

1. Navigate to your Harness Code URL
2. Complete the Okta/SSO login flow
3. Verify you can see your repositories
4. Navigate to Jira and log in there too

### Step 3: Press Enter to Save

Once logged in everywhere, go back to your terminal and press **Enter**. The session is now saved to `chrome-user-data/`.

> ⚠️ **Note:** The `chrome-user-data/` directory contains your auth session. It's gitignored and should never be committed.

---

## 🎮 Usage

### Option 1: Web UI (Recommended)

Start the web server:

```bash
cd web
npm run dev
```

Then open **http://localhost:3000** in your browser.

1. **Setup Page** — Enter your user ID, repo URLs, and date range
2. **Generate** — Click "Generate Self Review" to run the pipeline
3. **Review** — View your R-H-G review with copy buttons
4. **Data** — Browse all generated JSON files

### Option 2: CLI

Run the pipeline directly from command line:

```bash
# Edit the config file first
nano data/pipeline-config.json
```

Example config:
```json
{
  "userId": "1374",
  "repoUrls": [
    "https://harness0.harness.io/ng/.../repos/your-repo"
  ],
  "roleLevel": "Senior Software Engineer",
  "frameworkPath": "data/career-framework/SSE.txt"
}
```

Then run:
```bash
npm run pipeline
```

---

## 📁 Project Structure

```
self-review-ai/
├── src/
│   ├── crawler/          # Playwright-based web scraping
│   │   ├── browser.ts    # Chrome context management
│   │   ├── pr-crawler.ts # PR list extraction
│   │   └── jira-crawler.ts
│   ├── normalizer/       # Data parsing & types
│   │   ├── pr-parser.ts
│   │   └── types.ts
│   ├── summarizer/       # LLM integration
│   │   ├── llm-client.ts # Ollama API client
│   │   └── pr-summarizer.ts
│   ├── framework/        # Career framework
│   │   ├── parser.ts
│   │   └── aligner.ts
│   ├── synthesizer/      # R-H-G generation
│   │   ├── scoring.ts    # Deterministic scoring
│   │   └── rhg-synthesizer.ts
│   └── pipeline/         # Orchestration
├── scripts/
│   ├── login.ts          # SSO authentication helper
│   ├── run-pipeline-with-config.ts  # Main pipeline
│   └── test-*.ts         # Verification scripts
├── web/                  # Next.js UI
│   └── src/app/
│       ├── page.tsx      # Setup form
│       ├── review/       # Review display
│       ├── data/         # Data viewer
│       └── api/          # Backend routes
├── data/
│   └── career-framework/ # Role expectation files
│       └── SSE.txt       # Senior Software Engineer
└── chrome-user-data/     # Persistent auth (gitignored)
```

---

## 📊 Output Files

The pipeline generates these files in the `data/` directory:

| File | Description |
|------|-------------|
| `raw.json` | All parsed PR data with Jira context |
| `processed.json` | WHAT/WHY/HOW/IMPACT summaries for each PR |
| `alignment.json` | Career framework competency mapping |
| `self-review.json` | Final R-H-G review with suggested rating |

All files are viewable in the web UI at `/data`.

---

## 🔧 Configuration

### Career Framework

The tool supports multiple role levels. Each has its own expectations file in `data/career-framework/`:

| Role | File | Description |
|------|------|-------------|
| SE1 | `SE1.txt` | Software Engineer 1 (Entry level) |
| SE2 | `SE2.txt` | Software Engineer 2 |
| SSE1 | `SSE1.txt` | Senior Software Engineer 1 |
| SSE2 | `SSE2.txt` | Senior Software Engineer 2 |
| Staff1 | `Staff1.txt` | Staff Engineer 1 |
| Staff2 | `Staff2.txt` | Staff Engineer 2 |
| Principal | `Principal.txt` | Principal Engineer |
| Architect | `Architect.txt` | Architect |
| Distinguished | `Distinguished.txt` | Distinguished Engineer |

To customize expectations, edit the relevant `.txt` file:

```
# Senior Software Engineer 1 (SSE1) - Career Framework

### Frontend

#### Technical Excellence
- Builds scalable, maintainable systems
- Delivers high-quality code consistently
...
```

### LLM Settings

Edit `src/summarizer/llm-client.ts` to change the model:

```typescript
export const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: 'qwen2.5:7b',  // Change this
  baseUrl: 'http://127.0.0.1:11434',
  temperature: 0,
};
```

---

## 🐛 Troubleshooting

### "Connection refused" to Ollama

```bash
# Ensure Ollama is running
ollama serve

# Check if it's listening
curl http://127.0.0.1:11434/api/tags
```

### "Model not found"

```bash
# Pull the required model
ollama pull qwen2.5:7b

# Verify
ollama list
```

### Browser closes immediately

```bash
# Re-run login to refresh auth session
npm run login
```

### "Timeout" during PR crawling

- Increase timeout in `src/crawler/pr-crawler.ts`
- Check your network connection
- Ensure you're logged in (run `npm run login`)

### Web UI shows blank page

```bash
# Restart the dev server
cd web
npm run dev
```

---

## 🧪 Testing Your Setup

Run these commands to verify everything works:

```bash
# 1. Test browser launches and auth works
npm run test:browser

# 2. Test PR crawling
npm run test:crawler

# 3. Test Jira fetching
npm run test:jira
```

---

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run login` | Open Chrome for SSO authentication |
| `npm run pipeline` | Run the full self-review pipeline |
| `npm run test:browser` | Verify Chrome profile works |
| `npm run test:crawler` | Test PR list fetching |
| `npm run test:jira` | Test Jira ticket fetching |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) for browser automation
- [Ollama](https://ollama.com/) for local LLM inference
- [Next.js](https://nextjs.org/) for the web framework

---

**Built with ❤️ for engineers who want evidence-based performance reviews.**
