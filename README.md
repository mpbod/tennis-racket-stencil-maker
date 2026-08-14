# Tennis String Stencil Maker

A web app for creating paint stencils for tennis racket strings. Upload any image or SVG, position it over a realistic string bed, preview exactly where paint will land (only the parts of the design that intersect the strings), and export a print-ready stencil SVG at true physical size.

## Features

- **Upload** PNG/JPG images or SVG files (drag & drop or browse)
- **Live string-bed preview** — shows only the intersection of your design and the strings, i.e. what the painted result will look like
- **Placement controls** — scale, offset, rotation, plus direct dragging on the preview
- **Racket parameters** — head size (95–110 sq in), string pattern (16×19, 16×18, 18×20), string thickness
- **Stencil mode** — flatten the design to a single paint colour
- **Export** — SVG sized in millimetres with head outline, centre cross-hairs, and faint string guides for alignment. Print at 100% scale, place behind the strings, and paint through.

## Running locally

It's a fully static site — no build step:

```sh
npx serve .
```

## Deploying to Vercel

```sh
npx vercel deploy
```

Or connect the repo in the Vercel dashboard; the included `vercel.json` marks it as a static deployment.
