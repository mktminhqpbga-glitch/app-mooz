# Third-party notices

## FFmpeg WebAssembly core

MuseFlow bundles the single-thread FFmpeg WebAssembly core from `@ffmpeg/core` 0.12.10 (`vendor/ffmpeg/ffmpeg-core.js` and `vendor/ffmpeg/ffmpeg-core.wasm`). This component is licensed under **GNU General Public License v2.0 or later (GPL-2.0-or-later)**. A copy of GPL v2 is included at [licenses/GPL-2.0.txt](licenses/GPL-2.0.txt).

- FFmpeg.wasm source and build files: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10
- FFmpeg source version used by this release: n5.1.4
- FFmpeg source: https://github.com/ffmpegwasm/ffmpeg.wasm-core/tree/n5.1.4-wasm
- Package: https://www.npmjs.com/package/@ffmpeg/core/v/0.12.10
- Package integrity: `sha512-dzNplnn2Nxle2c2i2rrDhqcB19q9cglCkWnoMTDN9Q9l3PvdjZWd1HfSPjCNWc/p8Q3CT+Es9fWOR0UhAeYQZA==`

The bundled FFmpeg core includes FFmpeg n5.1.4 and codec libraries including x264 and x265. MuseFlow is also distributed under GPL-2.0-or-later. Redistribution of the complete extension must comply with GPL-2.0-or-later requirements, including providing the corresponding source for the GPL-covered distribution.

## FFmpeg.wasm JavaScript wrapper

`vendor/ffmpeg/ffmpeg.js` and `vendor/ffmpeg/814.ffmpeg.js` are from `@ffmpeg/ffmpeg` 0.12.15 and are licensed under the MIT License. A copy is included at [licenses/MIT.txt](licenses/MIT.txt).

- Source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.15/packages/ffmpeg
- Package: https://www.npmjs.com/package/@ffmpeg/ffmpeg/v/0.12.15
- Package integrity: `sha512-1C8Obr4GsN3xw+/1Ww6PFM84wSQAGsdoTuTWPOj2OizsRDLT4CXTaVjPhkw6ARyDus1B9X/L2LiXHqYYsGnRFw==`

## DejaVu Sans

`vendor/fonts/DejaVuSans.ttf` is bundled for Vietnamese subtitle rendering by FFmpeg/libass.
Copyright and license notices (Bitstream Vera / DejaVu) are reproduced in
`vendor/fonts/LICENSE-DejaVu.txt`. The font is distributed without modifications.

## yt-dlp (optional local runtime)

The local media helper installs yt-dlp separately through pip; its code and binaries are not bundled in the extension ZIP. Project and licensing information: https://github.com/yt-dlp/yt-dlp . See the installed package's license and dependency notices.

## Affiliate product HTML parser

The desktop app uses parse5 8.0.0 (MIT) and entities 6.0.1 (BSD-2-Clause). Full notices: [parse5](licenses/parse5-MIT.txt), [entities](licenses/entities-BSD-2-Clause.txt). These dependencies parse public product metadata; no Shopee code or authenticated API is bundled.
