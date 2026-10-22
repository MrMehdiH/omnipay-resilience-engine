# 🛡️ Omnipay Resilience Engine

> A Zero-Auth Interactive Sandbox demonstrating Idempotency, DAG-based transaction state machines, and Growth Loop economics.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_15+-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 🎯 The 6-Second Pitch for CTOs & Tech Leads
This is not a standard CRUD application. It is a strictly architected, deterministic state machine built to handle distributed system chaos (Network Partitions, Double-Clicks, VPN Geo-blocking) with graceful degradation. 

It features a **Dual-Ecosystem Engine** that switches the entire application context—currency (USD/Toman), direction (LTR/RTL), payment rail (Stripe/Shaparak), and typography (Inter/Vazirmatn)—instantly without a reload.

## 🏗️ Architectural Highlights

### 1. Hexagonal & Pure Core (`src/core/`)
The business logic is mathematically pure, deterministic, and 100% environment-agnostic. **There is absolutely zero React, DOM, or Next.js dependency inside the core directory.**
*   **Idempotency Engine:** Prevents duplicate charges via `O(1)` memory lookups, Cyb53 payload fingerprinting, and single-flight coalescing for concurrent requests.
*   **Transaction DAG:** An event-driven Directed Acyclic Graph mapping `CART_LOCK -> IDEMPOTENCY -> OPTIMISTIC -> GATEWAY -> RETRY_BACKOFF -> DLQ_OR_COMMIT`.
*   **Unit Economics Growth Engine:** Calculates closed-form steady-state viral multipliers (K-Factor) and discounted LTV:CAC ratios based on Gupta-Lehmann models.

### 2. Strict I/O Boundaries (`src/schemas/`)
Every piece of data entering or exiting the core (API payloads, Gateway responses, Telemetry events) is strictly validated via **Zod schemas**. We fail fast at the boundary, meaning `src/core/` operates without `any` or runtime type assumptions.

### 3. Design Token System
Zero hardcoded colors or pixels in JSX. The UI is powered by a 3-tier CSS Custom Property architecture (Global -> Alias -> Component) merged with Tailwind CSS. 

## 🎮 Interactive Sandbox Features
*   **Chaos Controller:** Inject artificial latency, trigger AWS Full Jitter exponential backoff, simulate network partitions, or force hard IPG declines.
*   **DAG Visualizer:** Watch the transaction state machine mutate in real-time. Hit the "Double Click" simulator to see the Idempotency Engine instantly intercept and coalesce the redundant payload.
*   **Growth Calculator:** Slide the K-Factor and BNPL adoption rates to see real-time shifts in Unit Economics (Blended CAC, Discounted LTV, Repayment Horizon).

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone [https://github.com/MrMehdiH/omnipay-resilience-engine.git](https://github.com/MrMehdiH/omnipay-resilience-engine.git)

   ---

## 👨‍💻 Mastermind & Principal Architect

**Mehdi (Willam) Heydari | مهدی حیدری**  
*System Designer, Visionary & Multi-Agent AI Orchestrator*

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Mehdi_Heydari-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mehdi-heydari-7b70b9291)
[![GitHub](https://img.shields.io/badge/GitHub-MrMehdiH-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/MrMehdiH)
[![Telegram](https://img.shields.io/badge/Telegram-@Build__Second__Brain__Owner-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Build_Second_Brain_Owner)
[![Email](https://img.shields.io/badge/Email-mr.mhd.2000p@gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:mr.mhd.2000p@gmail.com)

### 🤝 Multi-Agent Engineering Orchestration
This repository showcases modern **AI-Augmented Software Architecture**, directed and orchestrated by **Mehdi (Willam) Heydari** as the central mastermind:
*   **🧠 Mastermind & Product Visionary:** Mehdi (Willam) Heydari
*   **📐 Co-Architect & Strategic Planner:** Google Gemini
*   **⚙️ Pure TS Core & Deterministic Testing:** Anthropic Claude
*   **🎨 Reactive UI & 3-Tier Token Assembly:** Antigravity IDE