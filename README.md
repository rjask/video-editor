# Video Editor

A simple browser-based video editor. Upload a video from your computer and:

- **Trim** — cut it down to a start/end range
- **Crop** — cut the frame to a custom rectangle
- **Captions** — burn in one or more text captions with custom timing, position, size, and color

All processing happens **in your browser** using [ffmpeg.wasm](https://ffmpegwasm.netlify.app/) — no files are uploaded to any server. This works with videos you already have (your own footage or clips you have rights to edit); it does not fetch or download anything from YouTube or any other site.

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000

## Deploy

Plain Node/Express app. Deploy anywhere that runs Node (Railway, Render, Fly.io, etc.). Start command: `npm start`.
