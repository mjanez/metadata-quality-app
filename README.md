# Metadata Quality Assessment Tool - Next.js + Tailwind CSS

A modern, ultra-simplified RDF metadata validation and quality assessment tool built with **Next.js 15** and **Tailwind CSS 4**. This application validates RDF datasets against DCAT profiles and calculates FAIR+C quality metrics.

## Key Features

- ✅ **Multi-format RDF parsing**: Turtle, RDF/XML, JSON-LD, N-Triples
- ✅ **SHACL validation**: Against 3 profiles (DCAT-AP, DCAT-AP-ES, NTI-RISP)
- ✅ **FAIR+C metrics**: Findability, Accessibility, Interoperability, Reusability, contextuality
- ✅ **Dual input modes**: Direct text input or URL download
- ✅ **Interactive visualizations**: Radar charts with Chart.js
- ✅ **Internationalization**: English and Spanish (next-intl)
- ✅ **Dark mode**: Persistent theme toggle
- ✅ **Fully responsive**: Mobile-first design with Tailwind CSS
- ✅ **Type-safe**: TypeScript 5.x with strict mode

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/en/download) 18+ or 20+
- [npm](https://docs.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)

### Installation

```bash
# Clone the repository
git clone https://github.com/mjanez/metadata-quality-app.git
cd metadata-quality-app

# Install dependencies
npm install

# Run development server
npm run dev
```

> [!TIP]
> Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Tech Stack

### Core Framework
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.x** - Type safety

### UI Framework
- **Tailwind CSS 4** - Utility-first CSS
- **Lucide React** - Modern icon library
- **class-variance-authority** - Type-safe component variants
- **clsx + tailwind-merge** - Conditional class composition

### RDF & Validation (Core MQA Libraries)
- **n3** - RDF parsing and manipulation
- **rdfxml-streaming-parser** - Efficient RDF/XML parsing
- **shacl-engine** - SHACL validation
- **sparqljs** - SPARQL query parsing

### Visualization
- **Chart.js** - Radar charts for FAIR+C metrics
- **react-chartjs** - React wrapper for Chart.js

### Internationalization
- **next-intl** - i18n for Next.js App Router

## Project Structure

```
metadata-quality-app/
├── app/
│   ├── [locale]/                    # i18n routes
│   │   ├── layout.tsx               # Root layout with i18n provider
│   │   ├── page.tsx                 # Main single-page app
│   │   └── globals.css              # Tailwind base + custom styles
│   │
│   ├── api/                         # Backend API routes
│   │   ├── health/route.ts          # Health check
│   │   ├── validate-url/route.ts    # URL validation
│   │   └── download-data/route.ts   # RDF download
│   │
│   ├── components/                  # React components
│   │   ├── ValidationForm.tsx       # Main form with tabs
│   │   ├── ValidationResults.tsx    # Results container
│   │   ├── QualityChart.tsx         # Radar chart
│   │   ├── QualityMetrics.tsx       # Metrics accordion
│   │   ├── SHACLTable.tsx           # Violations table
│   │   ├── LanguageToggle.tsx       # EN/ES switcher
│   │   └── ThemeToggle.tsx          # Dark/light mode
│   │
│   ├── lib/                         # Core business logic
│   │   ├── rdf.ts                   # RDF parsing (n3, rdfxml)
│   │   ├── shacl.ts                 # SHACL validation
│   │   ├── quality.ts               # FAIR+C metrics calculation
│   │   ├── sparql.ts                # SPARQL queries
│   │   ├── api-client.ts            # API fetch utilities
│   │   ├── config.ts                # MQA profile configuration
│   │   └── utils.ts                 # Tailwind utilities (cn())
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useValidation.ts         # Validation orchestrator
│   │   └── useTheme.ts              # Theme management
│   │
│   └── types/
│       └── index.ts                 # TypeScript type definitions
│
├── messages/                        # i18n translations
│   ├── en.json                      # English
│   └── es.json                      # Spanish
│
├── public/
│   └── data/                        # Vocabularies (JSONL)
│
├── i18n.ts                          # i18n configuration
├── middleware.ts                    # Locale redirect middleware
├── next.config.ts                   # Next.js configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── package.json
```

## Tailwind CSS Architecture

### Custom Configuration

The project uses a custom Tailwind configuration with:

- **Custom color palette** for FAIR+C metrics
- **Dark mode** with class-based strategy
- **Custom components**: `.card`, `.btn-primary`, `.btn-secondary`
- **Custom utilities**: `.scrollbar-thin`, `.scrollbar-hide`
- **Plugins**: `@tailwindcss/forms`, `@tailwindcss/typography`

### Utility Function: `cn()`

```typescript
import { cn } from '@/app/lib/utils';

// Conditional classes with automatic conflict resolution
<div className={cn(
  'base-classes',
  condition && 'conditional-class',
  'override-class'
)} />
```

## Internationalization

The app supports English and Spanish:

```typescript
// In components
import { useTranslations } from 'next-intl';

const t = useTranslations();
t('validation.title') // Returns localized string
```

Toggle language using the `<LanguageToggle />` component.

## RDF Format Support

The app auto-detects and parses these RDF formats:

1. **Turtle** (`.ttl`)
2. **RDF/XML** (`.rdf`, `.xml`)
3. **JSON-LD** (`.jsonld`)
4. **N-Triples** (`.nt`)
5. **N-Quads** (`.nq`)

## FAIR+C Quality Dimensions

The tool calculates quality scores across 5 dimensions:

1. **Findability** - Metadata discoverability
2. **Accessibility** - Data access mechanisms
3. **Interoperability** - Standards compliance
4. **Reusability** - License and provenance
5. **contextuality** - Spatial/temporal coverage

Each dimension has weighted metrics that contribute to an overall quality score (0-100).

## Validation Profiles

Three [DCAT](https://www.w3.org/TR/vocab-dcat-3/) profiles are supported:

- [**DCAT-AP**](https://semiceu.github.io/DCAT-AP/) - EU application profile.
- [**DCAT-AP-ES**](https://datosgobes.github.io/DCAT-AP-ES/) - Spanish application profile based on DCAT-AP.
- [**NTI-RISP (2013)**](https://datosgobes.github.io/NTI-RISP/) - Spanish metadata model previous to DCAT. Deprecated by DCAT-AP-ES.

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please open an issue or PR.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [DCAT-AP Specification](https://joinup.ec.europa.eu/collection/semantic-interoperability-community-semic/solution/dcat-application-profile-data-portals-europe)
- [SHACL Specification](https://www.w3.org/TR/shacl/)
- [n3.js Documentation](https://github.com/rdfjs/N3.js)


---

**Built with ❤️ using Next.js 15 + Tailwind CSS 4 for the Open Data community**
