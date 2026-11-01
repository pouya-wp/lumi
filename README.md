<div align="center">

# ✦ Lumi

### Modern Collaborative Workspace, Team Intelligence & Productivity Platform

[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-black?style=flat-square&logo=flutter)](https://flutter.dev)
[![TypeScript](https://img.shields.io/badge/Stack-Node.js%20%2B%20TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Flutter](https://img.shields.io/badge/Mobile-Flutter%203.x-02569B?style=flat-square&logo=flutter)](https://flutter.dev)
[![Realtime](https://img.shields.io/badge/Realtime-Yjs%20CRDTs%20%2B%20WebSocket-orange?style=flat-square)](https://yjs.dev)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Pouya%20Sadeghpour-181717?style=flat-square&logo=github)](https://github.com/pouya-wp)

<p align="center">
  <b>Lumi</b> is an all-in-one team workspace uniting project planning, sprint methodologies, Notion-style real-time collaborative docs, native Flutter mobile apps, AI assistants, and enterprise API integrations into a unified, fluid experience.
</p>

</div>

---

## ✨ Features

- 📋 **Flexible Planning Views** — Kanban boards, interactive task lists, spreadsheet tables, Shamsi/Solar calendars, Gantt timelines, and team workloads.
- ⚡ **Methodology Engines** — Built-in Agile Sprints, OKRs, GTD, Eisenhower Matrix, Pomodoro focus mode, and habit tracking.
- 📝 **Real-Time Collaborative Docs** — Notion-style block editor powered by Yjs CRDTs for sub-millisecond multi-user synchronization.
- 🤖 **AI Assistant** — Natural language task extraction, subtask decomposition, daily agendas, and meeting summarization.
- 📱 **Native Mobile Parity** — Offline-first Flutter app for iOS and Android with biometric authentication and background sync.
- 🔗 **Integrations & Webhooks** — Full public REST API, webhooks, GitHub repository syncing, Telegram bot, and iCal calendar export.

---

## 🏗️ Architecture

```
Lumi Monorepo Structure
├── apps/
│   ├── web/        (Next.js / Vite web client with Soft Canvas UI)
│   ├── api/        (Fastify / Node.js backend with WebSocket & Yjs server)
│   └── mobile/     (Flutter cross-platform application for Android & iOS)
├── packages/
│   ├── core/       (Shared domain types, validation schemas, and utilities)
│   ├── design/     (Design tokens, icons, and reusable component library)
│   └── realtime/   (WebSocket and CRDT synchronization engine)
└── docs/           (Comprehensive product specs, deployment, and API guides)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Flutter 3.22+ (for mobile)
- Docker / Docker Compose

### Development Setup

```bash
# Clone the repository
git clone https://github.com/pouya-wp/lumi.git
cd lumi

# Install monorepo dependencies
pnpm install

# Start development services
pnpm dev
```

---

## 📄 License

Distributed under the MIT License.

---

<div align="center">
  <sub>Crafted with precision & passion by <b><a href="https://github.com/pouya-wp">Pouya Sadeghpour</a></b></sub>
</div>
