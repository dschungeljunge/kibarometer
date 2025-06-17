# Kibarometer 🧭

**Ein Open-Source-Tool zur Erfassung und Analyse der Haltung von Lehrenden gegenüber Künstlicher Intelligenz im Bildungsbereich.**

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tech Stack: Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Datenbank: Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.io/)
[![Deployment: Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)

Kibarometer ist eine Webanwendung, die es Lehrpersonen und anderen Bildungsfachleuten ermöglicht, ihre Einstellung zu KI durch einen wissenschaftlich fundierten Fragebogen zu reflektieren. Die Anwendung bietet eine sofortige, personalisierte Auswertung und dient gleichzeitig als Forschungsplattform, um Trends und Zusammenhänge zu analysieren.

## ✨ Features

- **Dynamischer Fragebogen**: Ein interaktiver Test mit 21 Fragen zur Erfassung demografischer Daten und der KI-Haltung.
- **Personalisierte Auswertung**: Nutzer erhalten direkt nach dem Test eine grafische Auswertung und werden einem von acht KI-Persönlichkeitstypen zugeordnet.
- **Forschungs-Dashboard**: Eine passwortgeschützte Seite für Forschende mit aggregierten, anonymisierten Daten, Item-Statistiken und Gruppenvergleichen (ANOVA).
- **Datenschutz im Fokus**: Die Forschungsdaten werden nur nach explizitem Einverständnis (`consent = 'ja'`) der Nutzer erhoben.
- **Modernster Tech-Stack**: Gebaut mit Next.js, TypeScript, Tailwind CSS und Supabase.

## 🚀 Lokale Entwicklung

Folgen Sie diesen Schritten, um das Projekt lokal aufzusetzen:

1.  **Repository klonen:**
    ```bash
    git clone https://github.com/dschungeljunge/kibarometer.git
    cd kibarometer
    ```

2.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```
    *(oder `pnpm install` / `yarn install`)*

3.  **Umgebungsvariablen einrichten:**
    Erstellen Sie eine `.env.local`-Datei im Stammverzeichnis, indem Sie die `.env.example`-Datei kopieren:
    ```bash
    cp .env.example .env.local
    ```
    Öffnen Sie die `.env.local` und tragen Sie Ihre Supabase-Zugangsdaten ein. Diese erhalten Sie in Ihrem [Supabase Dashboard](https://supabase.com/dashboard).

4.  **Entwicklungsserver starten:**
    ```bash
    npm run dev
    ```

    Öffnen Sie [http://localhost:3000](http://localhost:3000) in Ihrem Browser.

## 🛠️ Tech-Stack

| Kategorie   | Technologie                                  |
|-------------|----------------------------------------------|
| Framework   | Next.js 14 (App Router)                      |
| Sprache     | TypeScript                                   |
| UI          | Tailwind CSS, Recharts für Diagramme         |
| Backend     | Supabase (PostgreSQL Datenbank & Auth)       |
| Deployment  | Vercel                                       |
| Code-Qualität | ESLint, Prettier                             |


## 🤝 Wie man beiträgt

Wir freuen uns über Beiträge aus der Community! Egal ob es sich um Fehlerberichte, Feature-Wünsche oder Code-Beiträge handelt.

Lesen Sie unsere (bald erscheinenden) `CONTRIBUTING.md`-Richtlinien, um mehr zu erfahren.

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz veröffentlicht. Weitere Details finden Sie in der `LICENSE`-Datei.
