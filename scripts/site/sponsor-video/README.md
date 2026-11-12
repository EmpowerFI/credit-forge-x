# The sponsors film

The short silent film on the Sponsors page (`public/site/patrocinadores-{pt,en}.mp4`, with the poster `.jpg`), made with Remotion from the tutorial's own screenshots (`public/app/diario-tour/`).

To render it again, in a scratch folder with `remotion`, `@remotion/cli`, `@remotion/transitions` and `@remotion/google-fonts` 4.x installed, copy these files into `src/`, the tour images `2-entry-pt.jpg` and `2-entry-en.jpg` and the EmpowerFI mark as `empowerfi-mark.png` (a square PNG) into `public/`, then:

```
npx remotion render src/index.ts SiteSponsorPt patrocinadores-pt.mp4 --codec=h264 --crf=26
npx remotion render src/index.ts SiteSponsorEn patrocinadores-en.mp4 --codec=h264 --crf=26
npx remotion still src/index.ts SiteSponsorPt patrocinadores-pt.jpg --frame=130 --image-format=jpeg
```
