# The diary film

The short silent film on the Entrepreneurs page (`public/site/diario-{pt,en}.mp4`, with the poster `.jpg`), made with Remotion from the tutorial's own screenshots (`public/app/diario-tour/`).

To render it again, in a scratch folder with `remotion`, `@remotion/cli`, `@remotion/transitions` and `@remotion/google-fonts` 4.x installed, copy these files into `src/`, the tour images `1-today`, `2-entry`, `3-review`, `4-month`, `5-reading` (both languages) and the EmpowerFI mark as `empowerfi-mark.png` (a square PNG) into `public/`, then:

```
npx remotion render src/index.ts DiaryPt diario-pt.mp4 --codec=h264 --crf=26
npx remotion render src/index.ts DiaryEn diario-en.mp4 --codec=h264 --crf=26
npx remotion still src/index.ts DiaryPt diario-pt.jpg --frame=130 --image-format=jpeg
```
