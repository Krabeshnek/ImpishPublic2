# Impish - Audit Toolbox

Version 0.1 - Daniel's audit toolbox

A React-based multi-page application for financial auditing tools.

## Features

- **Audit Sampler**: Statistical sampling tool for financial audits with target testing and Excel export
- **3:12 K10 Calculator**: Calculator for Swedish tax regulations (3:12 rules)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
  components/
    AuditSampler.jsx      # Main audit sampling tool
    ThreeTwelveCalculator.jsx  # 3:12 K10 calculator
    Navbar.jsx            # Navigation component
  App.jsx                 # Main app with routing
  index.js                # React entry point
```

## Technologies

- React 18
- React Router DOM 6
- Tailwind CSS (via CDN)

