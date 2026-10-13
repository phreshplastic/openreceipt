import { bodyFontData, italicFontData, wordmarkFontData } from "./font-data";
export { bodyFontData, italicFontData, wordmarkFontData } from "./font-data";

export function bodyFontFace(markup = "") {
  const marks = wordmarkFontData.filter((font) => markup.includes(font.family)).map((font) => `@font-face{font-family:'${font.family}';src:url(${font.data}) format('truetype');font-weight:${font.weight}}`).join("");
  const italics = markup.includes('font-style="italic"') ? italicFontData.map((data, index) => `@font-face{font-family:Inter;src:url(${data}) format('truetype');font-weight:${[400,600,750][index]};font-style:italic}`).join("") : "";
  return `<defs><style>${bodyFontData.map((data, index) => `@font-face{font-family:Inter;src:url(${data}) format('truetype');font-weight:${[400,600,750][index]};font-style:normal}`).join("")}${italics}${marks}</style></defs>`;
}
