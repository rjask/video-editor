const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Headers that are safe defaults for running ffmpeg.wasm in the browser.
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Video editor running on port ${PORT}`);
});
