## Buno

A Next.js budgeting web app to set a monthly budget, log expenses, 
and analyze spending patterns over time without giving the actual figures.

## Features
- Set and edit monthly budget (USD / INR toggle support)
- Add and delete expenses
- Qualitative Spending Window: daily spending pace without numerical stress
- AI Pattern Insights: observations on spending rhythm and categories
- Editorial Ledger visual design system

## Setup

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000` by default. Build output uses 
the standard Next.js `.next` folder.

## Tech Stack
- Next.js (App Router)
- React & Tailwind CSS
- TypeScript

## AI Tooling & Meaningful Usage Disclosure

This project meaningfully incorporates both **GPT-5.6** and **Codex** across the live product experience and development lifecycle:

### 1. ChatGPT 5.6 (Core Runtime Engine & AI Architecture)
- **Live In-App Integration**: GPT-5.6 powers Buno's core defining feature via backend API routes (`/api/advice` and `/api/pattern-insight`). Rather than decorative text, it acts as the primary runtime engine—dynamically synthesizing user spending rhythm into calm, qualitative daily guidance and pattern observations under strict zero-numerical system constraints.
- **Architectural & Prompt Engineering**: GPT-5.6 was used during development to design the qualitative safety guardrails, regex verification filters, multi-currency conversion logic (USD/INR), and system prompt structure.

### 2. Codex (Codebase Construction & Layout Refactoring)
- **Core Code Scaffolding**: Codex authored the vast majority of the application codebase, including Next.js App Router scaffolding, component structures, and state management logic.
- **Layout & Refactoring**: Codex was used extensively across feature branches (`codex/*`) to transform the layout into the *Editorial Ledger* grid system and perform PR code reviews.
- **Review Process**: All AI-proposed changes and branch pull requests were manually code-reviewed, tested locally (`npm run dev` and `npm run test`), and verified before being merged into `main`.

## Project Structure

| File | Purpose |
|---|---|
| `app/page.tsx` | Main dashboard: editorial ledger layout, budget setup, and expense logging |
| `app/api/advice/route.ts` | Qualitative AI advice endpoint powered by ChatGPT 5.6 API |
| `app/api/pattern-insight/route.ts` | AI pattern insight endpoint powered by ChatGPT 5.6 API |
| `components/ProbabilityWindow.tsx` | Real-time qualitative spending pace and risk window |
| `components/PatternInsight.tsx` | AI spending pattern observations component |
| `lib/calc.ts` | Qualitative budget calculations and risk state evaluation |
| `lib/patterns.ts` | Spending rhythm analysis and pattern metrics |
