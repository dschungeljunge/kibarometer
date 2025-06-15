# edu-KI Puls 🚀

Selbsttest & Forschungsplattform zur Haltung von Lehrpersonen gegenüber Künstlicher Intelligenz im Unterricht.

## Features

- **Dynamischer Fragebogen** (Next.js / TypeScript / Tailwind)
  - Demografie + 21 Item-Statements
  - Opt-in-Einverständnis für wissenschaftliche Nutzung
  - Automatisches Weiterblättern, dezenter Zurück-Button
- **Testauswertungsseite** (`/auswertung`) – Storytelling-Format mit KI-Persönlichkeitstypen und demografischen Vergleichen
- **Forschungs-Dashboard** (ANOVA, Ranglisten, Item-Statistiken)
  - Nur Daten mit `consent = 'ja'` fließen in die Analysen ein
- **Supabase-Backend** (PostgreSQL)
- Vercel CI/CD & Open Source

## KI-Persönlichkeitstypen

Die Testauswertungsseite klassifiziert Nutzer basierend auf ihrer **KI-Chancenwahrnehmung** (Optimismus) und **KI-Risikowahrnehmung** (Skepsis) in 8 verschiedene Persönlichkeitstypen:

### 🧠 **Der Komplexe**
- **Bedingung**: Hohe Chancenwahrnehmung (>4) + Hohe Risikowahrnehmung (>4)
- **Charakteristika**: Sieht sowohl große Potentiale als auch ernste Risiken in KI
- **Beschreibung**: Diese differenzierte Sichtweise zeigt echte Expertise und Durchdachtheit

### 🌟 **Der Optimist**
- **Bedingung**: Hohe Chancenwahrnehmung (>4) + Geringe Risikowahrnehmung (<2.5)
- **Charakteristika**: Fokussiert auf KI-Möglichkeiten, wenig Bedenken
- **Beschreibung**: Bereit neue Wege zu erkunden, Vertrauen in die Technologie

### 🔍 **Der Skeptiker**
- **Bedingung**: Geringe Chancenwahrnehmung (<2.5) + Hohe Risikowahrnehmung (>4)
- **Charakteristika**: Vorsichtig, fokussiert auf KI-Gefahren
- **Beschreibung**: Kritische Haltung ist wertvoll für verantwortungsvolle KI-Entwicklung

### 🤔 **Der Unentschlossene**
- **Bedingung**: Geringe Chancenwahrnehmung (<2.5) + Geringe Risikowahrnehmung (<2.5)
- **Charakteristika**: Noch unklare Position zu KI
- **Beschreibung**: Völlig normal bei diesem komplexen, sich schnell wandelnden Thema

### ⚖️ **Der Ausgewogene**
- **Bedingung**: Chancen- und Risikowahrnehmung nahezu identisch (Differenz <0.5)
- **Charakteristika**: Perfekte Balance zwischen beiden Aspekten
- **Beschreibung**: Durchdachte Balance von Chancen und Risiken

### 🌅 **Der Hoffnungsvolle**
- **Bedingung**: Chancenwahrnehmung deutlich höher als Risikowahrnehmung (+1 Punkt)
- **Charakteristika**: Optimistisch, aber nicht blind für Risiken
- **Beschreibung**: Sieht mehr Chancen als Risiken, bleibt aber realistisch

### 🛡️ **Der Vorsichtige**
- **Bedingung**: Risikowahrnehmung deutlich höher als Chancenwahrnehmung (+1 Punkt)
- **Charakteristika**: Skeptisch, aber nicht gänzlich verschlossen
- **Beschreibung**: Sieht mehr Risiken als Chancen, verschließt sich aber nicht den Möglichkeiten

### 🎯 **Ausgewogen** (Default)
- **Bedingung**: Alle anderen Kombinationen in mittleren Bereichen
- **Charakteristika**: Ausgewogene, abwartende Haltung
- **Beschreibung**: Weder übermäßig skeptisch noch unkritisch optimistisch

### Zuordnungslogik (TypeScript)

```typescript
const calculateKiType = (userPos: number, userNeg: number): string => {
  // Extreme Kombinationen (Priorität 1)
  if (userPos > 4 && userNeg > 4) return "Der Komplexe";
  if (userPos > 4 && userNeg < 2.5) return "Der Optimist";
  if (userPos < 2.5 && userNeg > 4) return "Der Skeptiker";
  if (userPos < 2.5 && userNeg < 2.5) return "Der Unentschlossene";
  
  // Balance-Check (Priorität 2)
  if (Math.abs(userPos - userNeg) < 0.5) return "Der Ausgewogene";
  
  // Tendenz-Check (Priorität 3)
  if (userPos > userNeg + 1) return "Der Hoffnungsvolle";
  if (userNeg > userPos + 1) return "Der Vorsichtige";
  
  // Default
  return "Ausgewogen";
};
```

**Wichtig**: Das System berücksichtigt, dass Optimismus und Skepsis gegenüber KI **nicht gegensätzlich** sind, sondern **gleichzeitig** existieren können. Dies führt zu realistischeren und nuancierteren Persönlichkeitsprofilen.

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
