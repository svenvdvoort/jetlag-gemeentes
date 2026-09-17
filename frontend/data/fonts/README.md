# Map label fonts

MapLibre can't draw any text without a glyph source, so the gemeente
name labels need these. They're served straight from this folder
(`CONFIG.GLYPHS_URL` in `js/config.js`) rather than from a font server,
so the map has no runtime dependency on anyone else's hosting.

```
Noto Sans Regular/
├── 0-255.pbf     # Basic Latin + Latin-1 Supplement
└── 256-511.pbf   # Latin Extended-A
```

MapLibre asks for one file per 256-codepoint range, and only for the
ranges the labels actually use - every gemeente name is plain ASCII, so
in practice only `0-255.pbf` is ever requested. `256-511.pbf` is here so
a name with an accented or otherwise extended Latin character doesn't
silently fail to render. Anything beyond that (say a name in Greek or
Cyrillic) would 404: download the matching range from the same source.

The folder name has to match the `text-font` in `CONFIG.MAP_LABELS`
exactly, spaces and all - that's the `{fontstack}` MapLibre substitutes
into the URL.

**Source**: built from [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans),
fetched as ready-made glyph ranges from MapLibre's demo font server
(`https://demotiles.maplibre.org/font/Noto%20Sans%20Regular/{range}.pbf`).

**License**: SIL Open Font License 1.1 - see `OFL.txt`.
