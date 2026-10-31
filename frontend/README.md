# AgriLearn Frontend

Learning platform homepage for Faculty of Agriculture students.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Then open the URL shown in the terminal (usually `http://localhost:5173`).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run preview` — preview the production build

## Project structure

```
frontend/
├── index.html              # Main HTML page
├── public/                 # Static files (favicon)
└── src/
    ├── main.jsx            # App entry point
    ├── App.jsx             # Combines all page sections
    ├── App.css
    ├── index.css           # Global styles & design tokens
    ├── hooks/
    │   └── useReveal.js    # Scroll fade-in animation
    └── components/
        ├── Navbar.jsx      # Top navigation
        ├── Hero.jsx        # “Hello, Future Agripreneur!”
        ├── InfoCards.jsx   # About, Aim, Objectives
        ├── Features.jsx    # What You’ll Get
        ├── Levels.jsx      # 100 / 200 / 300 / 500 levels
        ├── FAQ.jsx         # Frequently asked questions
        ├── Contact.jsx     # Contact form (UI only)
        ├── FooterCTA.jsx   # Bottom call-to-action banner
        └── Footer.jsx      # Site footer
```

## Pages

- `/` — Homepage
- `/signup` — Student Sign Up (frontend validation only)
- `/login` — Student Log In (frontend validation only)

Sign Up / Log In do not talk to a backend yet — successful submits only show a “coming soon” message.
