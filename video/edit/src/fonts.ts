import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Inter for everything editorial. The wordmark face is the same caps-only Ultra
 * subset the product prints on paper (Apache 2.0, licence beside the file), so the
 * film and the receipt share one type system rather than resembling one.
 */
export const fontsReady = Promise.all([
  loadFont({
    family: "InterVar",
    url: staticFile("fonts/inter-var.woff2"),
    format: "woff2",
    weight: "100 900",
  }),
  loadFont({
    family: "OpenReceiptSign",
    url: staticFile("fonts/ultra-sign.ttf"),
    format: "truetype",
    weight: "400",
  }),
]);
