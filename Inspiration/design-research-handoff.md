# Portfolio Redesign — Research & Handoff

> **For a Claude Desktop artifacts session.**
> Raw research from 19 game dev portfolios. No single site is "the answer."
> Generate multiple VERY DIFFERENT directions pulling from the full range of references.

---

## The Brief

Federico Giovannini's portfolio (Technical Designer, London) feels "too AI-y." The fonts especially — DM Sans, Instrument Serif, Sora, JetBrains Mono — are all heavily used in AI-generated designs. Rethink **fonts, colors, visual texture, and vibe**.

### Non-negotiable (stays as-is)
- **Card-hand navigation** — fan of cards at viewport bottom, drag to play zone to navigate. Strong differentiator.
- **Text destruction** — paper airplane shatters text, chars reform with GSAP physics
- **Theme switcher** — 3 themes cycling (visual identity of each theme can change)
- **SPA transitions** — card play triggers page navigation
- **Tech** — static HTML/CSS/JS, no build tools

### Open to change
- **Fonts** — #1 priority. Need distinctive, characterful choices with zero AI associations.
- **Hero doodles** — the floating circle is weak. Open to organic shapes, but they must scale with viewport (vw units / clip-path, not fixed-size elements).
- **Color palette** — open to rethinking all three themes
- **Section presentation** — "02 - About" labels, chip grids, tidbit boxes feel template-y
- **Intros/copy** — open to better wording, different images
- **Overall vibe** — needs to feel like a person made deliberate choices

---

## Research: 19 Game Dev Portfolios

### Deep Dives (Federico's 3 favorites)

**Jenova Chen** (jenovachen.info)
- Proxima Nova (everything) + Playfair Display italic (quotes only)
- Pure monochrome: white bg, #121212 text, #0085bd blue links
- Fixed left sidebar + full-bleed game art slideshow
- Zero texture, zero animations. The game screenshots ARE the design.
- Vibe: museum gallery. Total restraint.

**Dejobaan** (dejobaan.com)
- Poppins only (300-700). Single font family.
- White/bright/dark alternating section stripes. 3-column card grid.
- Stock Squarespace. No custom effects.
- Vibe: personality through writing, not design. The nav link `/aaaaa` IS the design.

**Manon Ghignoni** (wixsite portfolio)
- Rounded display serif heading (Recoleta family) + clean sans body
- Warm orange gradient hero, organic blob shapes connecting sections
- Pink/magenta accent pills, circular image crops, rounded everything
- 2x2 edge-to-edge project image grid with hover overlays for "Professional Projects"
- Vertical card carousel with rounded corners, image top, pill tags for "Personal & Student Projects"
- About section: dark rounded cards floating on orange blob background with personal photo integrated into the blob
- Skill categories (Game Design, Development, Level Design) as distinct dark cards
- Personal interests listed informally at the bottom — adds human touch
- Contact: simple centered section, social buttons as orange pills, blob continues behind
- Vibe: warm, approachable, personality-forward. "Feels like meeting someone, not viewing a resume."
- **Scaling issue**: her blob shapes are fixed-size and don't respond to viewport width — gaps on wide screens, overflow on narrow. Avoid this: use vw units or clip-path.
- **This is ONE possible direction to try** — warm/organic/rounded. Not the default or the anchor.

### All Other Sites — Key Data

**Trent Polack** (trentpolack.com)
- Archivo + Archivo Black (chunky grotesque)
- Cream #FAFAF7 bg, vivid orange #FF6123 accent
- Section-level color theming (alternating light/dark)
- Most visually assertive site in the set

**Chris Ingerson** (christopheringerson.com)
- Montserrat + Lato
- Warm parchment #E4DCD0 bg, teal #78B5B0, gold #E8C56A
- Earth-tone palette. Reads "craft-conscious."

**Remedy Games** (remedygames.com)
- Inconsolata (mono for labels) + Typekit sans (headings/body)
- Near-black #0f0f0f bg, white text, red #D6001C accent
- Full-viewport Vimeo hero video, Splide game carousel, slide-up scroll reveals
- Hover buttons with text-swap animation, animated hamburger menu
- Cinematic AAA studio energy

**Facepunch** (facepunch.com)
- Poppins only (all weights)
- Dark bg, white text, red accent
- Confident restraint. Games are famous enough to speak for themselves.

**Squeaky Wheel** (squeakywheel.ph)
- Roboto Slab (headings) + Raleway (body)
- Full-bleed section background images, animated GIF logo
- Warm, community-oriented indie studio

**Bithell Games** (bithellgames.com)
- K2D + Source Sans Pro + Space Mono
- Light grey #E8E8E8, fully monochrome
- Extreme minimalism — container for game key art, nothing else

**Brenda Romero** (brenda.games)
- System sans-serif. No custom fonts at all.
- White bg, blue #0085bd links
- 40-year veteran energy. The domain name > the design.

**Dylan Jones** (thedylanjones.com)
- Typekit sans, white/off-white bg
- Parallax full-bleed photography, magazine-editorial scroll
- Personal brand site — positions as speaker/CEO, not coder

**Dean Tate** (iamdeantate.com)
- Typekit serif/sans, sidebar nav
- The project list (BioShock, Half-Life Alyx, SWAT 4) IS the design
- Work speaks for itself — no visual flourish needed

**Josh Caratelli** (joshcaratelli.com)
- Strikingly defaults, single-page scroll
- "Let the work speak" — functional, no frills

**nalgames** (nalgames.com)
- Shrikhand (chunky display) + Bitter (serif body)
- Playful, slightly retro. "Creative professional, not too serious."

**Alex Kilmpasanis** (alexkilmpasanis.com)
- Futura PT only, grey #949494 text on white
- Extreme monochrome restraint — forces attention to project images

**Gerlogu** (gerlogu.com)
- Spline Sans + Montserrat, WordPress/Astra
- Uses BetterDocs — portfolio as documentation/knowledge base
- YouTube embeds with grayscale→color hover transition

**Non-functional:** Michael Manson (Squarespace expired), Shawn Beck (JS-only, no HTML), Roberta Williams (book promo, not a portfolio)

---

## Pattern Analysis

### Spectrum of Approaches
```
MINIMAL ◄──────────────────────────────────► EXPRESSIVE
Jenova Chen    Dean Tate    Facepunch    Trent Polack    Manon Ghignoni
Alex K         Brenda R     Dejobaan     Remedy          nalgames
Bithell        Josh C       Squeaky Wh   Dylan Jones
```

### What Feels Human (not AI)
- One opinionated font > three safe fonts
- Warm OR bold colors — not cold blue/purple gradients
- Restraint: do one thing confidently
- Personality in writing (Dejobaan proves stock design + great words works)
- Single strong accent color > gradient rainbow
- Letting work breathe — via white space OR dark simplicity

### What Feels AI-y (avoid)
- DM Sans, Inter, Roboto, Sora as body fonts
- Purple/blue gradients
- Numbered section labels ("02 - About")
- Chip grids with soft shadows and rounded corners
- Too many effects competing simultaneously
- Three "safe" fonts hedging instead of one committed choice

---

## Font Families Worth Exploring

**Display/Heading:**
Recoleta, Fraunces, Gambetta, Archivo Black, Shrikhand, Cabinet Grotesk, Clash Display, Satoshi, Zodiak, Erode, Playfair Display, Bricolage Grotesque

**Body:**
Bitter, General Sans, Switzer, Newsreader, Outfit, Plus Jakarta Sans, Literata

**Mono (if used for labels):**
Inconsolata, IBM Plex Mono, Commit Mono, JetBrains Mono (only if paired with non-AI heading font)

---

## Current Content

```
Name: Federico Giovannini
Title: Technical Designer
Location: London, UK
Current: Logifuture
Side project: Coffin-Likker
Badge: "Open to opportunities"

Tagline: "Never shipped a boring product."
Desc: "Developer with three years of experience shipping a variety
of web and gaming products. I have a passion for design and champion
high standards of polish."

Projects: Logifuture (casino games), Coffin-Likker (indie game),
Lost Satellite Studios

Skills: JavaScript, C#, C++, Python, GDScript
Tools: Node.js, PixiJS, GSAP, Unity, Godot, Three.js, Figma, Miro
Education: BSc Physics & Astronomy (Queen Mary), Game Programming (CG Spectrum)
Languages: English & Italian (fluent), French (conversational)
Personality: Sports climber, stand-up comedian, built website with Claude
over a weekend, interviewed Deep Rock Galactic's design director about
positive community design.
```

---

## Instructions for Desktop Session

1. Read this doc fully. Look at Inspiration folder screenshots for Manon visual reference — but treat her site as one possible direction, not the default.
2. **Generate 3-4 directions that look like different designers made them.** Pull from different parts of the research — different ends of the minimal↔expressive spectrum. Examples of possible directions (invent your own, these are just prompts):
   - Gallery-minimal (Jenova/Bithell end of spectrum)
   - Dark cinematic (Remedy/Facepunch territory)
   - Warm organic (Manon/Chris Ingerson warmth)
   - Brutalist/typographic (monospace-forward, harsh grid)
   - Retro-playful (Shrikhand/nalgames energy)
   - Swiss modernist (tight grid, strict hierarchy)
   - Bold accent (Trent Polack's hot-orange-on-cream confidence)
3. Each direction needs: font pairing, color palette, hero concept, component style, vibe statement.
4. The card-hand system and text destruction are staying — you're reskinning, not restructuring.
5. Federico is a stand-up comedian and climber with a physics degree who makes games. The design should let personality come through.
6. The "02 - About" section labels, chip grids, and tidbit boxes are the most template-feeling parts. Rethink how that info is presented in each direction.
7. Ask which elements from which directions resonate, then converge toward a final system.
