# edu-KI Puls 🚀

Selbsttest & Forschungsplattform zur Haltung von Lehrpersonen gegenüber Künstlicher Intelligenz im Unterricht.

## Features

- **Dynamischer Fragebogen** (Next.js / TypeScript / Tailwind)
  - Demografie + 21 Item-Statements
  - Opt-in-Einverständnis für wissenschaftliche Nutzung
  - Automatisches Weiterblättern, dezenter Zurück-Button
- **Ergebnisseite "KI Puls"** – persönliches Profil vs. Gesamtdurchschnitt
- **Forschungs-Dashboard** (ANOVA, Ranglisten, Item-Statistiken)
  - Nur Daten mit `consent = 'ja'` fließen in die Analysen ein
- **Supabase-Backend** (PostgreSQL)
- Vercel CI/CD & Open Source

## Tech-Stack

| Ebene       | Tooling                                      |
|-------------|----------------------------------------------|
| Frontend    | Next.js 13 App Router, TypeScript, Tailwind  |
| Charts      | Recharts                                     |
| Backend     | Supabase (DB + Auth)                         |
| Deployment  | Vercel                                       |
| Lint/Format | ESLint, Prettier                             |

## Datenbank-Schema (Kurzform)

```sql
-- items
auto id, text text, category text check ('Positiv','Negativ','Kontrolle')

-- responses
auto id, demografische Felder …, consent text check ('ja','nein') default 'nein', created_at timestamp

-- answers
response_id → responses.id ON DELETE CASCADE,
item_id     → items.id,
value int check (1-5),
PRIMARY KEY (response_id, item_id)
```

## Lokaler Start

```bash
git clone https://github.com/dschungeljunge/kibarometer.git
cd kibarometer
pnpm install          # oder npm / yarn

# .env.local anlegen
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

pnpm dev              # http://localhost:3000
```

## Deployment

1. Supabase-Projekt mit oben stehendem Schema erstellen
2. Vercel-Import → Env-Vars setzen → Deploy

## Seed-Daten

Die Datei `items.txt` enthält alle Item-Formulierungen und kann für einen einmaligen Import in die Tabelle `items` verwendet werden.

## Lizenz

MIT © 2025
