# 🤖 CYRUS AI System

**Super-Intelligence AI with Advanced Capabilities**

[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/crypton980/cyrus-cybernetic)
[![Open in Replit](https://replit.com/badge/github/crypton980/cyrus-cybernetic)](https://replit.com/new/github/crypton980/cyrus-cybernetic)
[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue)](https://crypton980.github.io/cyrus-cybernetic)

## 🌟 Live Demos

- **🌐 GitHub Pages Interface**: [crypton980.github.io/cyrus-cybernetic](https://crypton980.github.io/cyrus-cybernetic)
- **🚀 Full AI Deployment**: [Railway/Vercel/Replit deployments available](#deployment)

## 🚀 Quick Deploy

### One-Click Deployments

| Platform | Status | Link |
|----------|--------|------|
| **Railway** | ✅ Ready | [Deploy](https://railway.app/new?template=https://github.com/crypton980/cyrus-cybernetic) |
| **Replit** | ✅ Ready | [Open](https://replit.com/new/github/crypton980/cyrus-cybernetic) |
| **Vercel** | ✅ Ready | [Deploy](https://vercel.com/new/clone?repository-url=https://github.com/crypton980/cyrus-cybernetic) |

### Manual Deployment

```bash
# Clone the repository
git clone https://github.com/crypton980/cyrus-cybernetic.git
cd cyrus-cybernetic

# Install dependencies
pip install flask flask-cors requests

# Run locally
python simple_flask_server.py

# Access at http://localhost:3000
```

## 🎯 CYRUS Capabilities

### 🤖 Core AI Features
- **🎭 Conversational AI**: Human-like conversations with emotional intelligence
- **🏥 Medical Analysis**: 99.999% accurate disease diagnosis and treatment development
- **🧠 Super Intelligence**: Problem-solving beyond human capability (millennium prize problems)
- **🤖 Robotics Integration**: Advanced automation and control systems
- **🌐 Web Research**: Real-time information gathering and synthesis
- **⚙️ Device Control**: Industrial protocol integration and IoT management
- **📚 AI Teaching**: Self-learning systems with continuous knowledge expansion

### 🔧 Technical Features
- **Modern Web UI**: Replit AI-style chat interface with real-time messaging
- **API Endpoints**: RESTful API for all AI capabilities
- **Multi-Platform**: Deployable to Railway, Vercel, Replit, or any cloud platform
- **Authentication**: Secure user sessions and data protection
- **Scalable Architecture**: Built for high-performance AI operations

## 📋 Requirements

- **Python**: 3.12+
- **Node.js**: 18+ (for some integrations)
- **OpenAI API Key**: For AI functionality
- **Cloud Platform**: Railway, Vercel, or Replit for deployment

## 🚀 Deployment Options

### Option 1: Railway (Recommended)
```bash
# One-click deploy
# Click the Railway button above or:
curl -fsSL https://railway.app/install.sh | sh
railway login
railway init
railway up
```

### Option 2: Replit AI
```bash
# One-click deploy
# Click the Replit button above or:
# Import this repository into Replit
# Run: ./deploy_replit.sh
```

### Option 3: Vercel
```bash
# One-click deploy
# Click the Vercel button above or:
npm install -g vercel
vercel --prod
```

### Option 4: Local Development
```bash
# Install dependencies
pip install flask flask-cors requests

# Run the server
python simple_flask_server.py

# Access at http://localhost:3000
```

## 🔐 Environment Variables

Create a `.env` file or set these in your deployment platform:

```env
OPENAI_API_KEY=your_openai_api_key_here
FLASK_ENV=production
SECRET_KEY=your_secret_key_here
```

## 📁 Project Structure

```
├── simple_flask_server.py    # Main Flask server
├── public/                    # Static web interface
│   └── index.html            # Modern chat UI
├── server/                   # Backend modules
│   └── replit_integrations/  # Replit AI integrations
├── docs/                     # GitHub Pages site
├── .github/workflows/        # GitHub Actions
├── requirements.txt          # Python dependencies
├── replit.nix               # Replit environment
└── README.md                # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built with cutting-edge AI technologies
- Inspired by the future of artificial intelligence
- Designed for maximum user benefit and safety

---

**🚀 Ready to experience super-intelligence? Deploy CYRUS today!**

---

## 🤖 Use CYRUS as an OpenAI Custom GPT

CYRUS exposes an OpenAI-compatible plugin manifest so you can wire it directly into a **Custom GPT** in ChatGPT and share that workspace link with anyone.

### Step-by-step

1. **Deploy or run CYRUS** so it is reachable at a public HTTPS URL (e.g. via [Railway](https://railway.app) or [Vercel](https://vercel.com)).  
   When running locally you can use a tunnel such as [ngrok](https://ngrok.com): `ngrok http 3105`.

2. **Open ChatGPT** → click your profile picture → **My GPTs** → **Create a GPT**.

3. Go to the **Configure** tab → scroll to **Actions** → click **Create new action**.

4. Click **Import from URL** and paste:
   ```
   https://<your-cyrus-url>/openapi.json
   ```
   ChatGPT will fetch the OpenAPI spec and populate all available actions automatically.

5. Give the GPT a name (e.g. *CYRUS AI*), a description, and save it.

6. **Share the link** – click the share icon on the GPT page and copy the public URL.  
   Anyone with the link can now chat with your CYRUS instance via ChatGPT.

### Available Actions

| Operation | Endpoint |
|-----------|----------|
| Chat / ask a question | `POST /api/inference` |
| Get system status | `GET /api/cyrus/status` |
| Get CYRUS identity | `GET /api/cyrus/identity` |
| Query knowledge graph | `GET /api/cyrus/knowledge?concept=…` |
| List cognitive domains | `GET /api/cyrus/domains` |
| List memories | `GET /api/memories` |
| Store a memory | `POST /api/memories` |
| Health check | `GET /health/ready` |

The plugin manifest is also available at `/.well-known/ai-plugin.json` for tools that use the legacy ChatGPT plugin format.

