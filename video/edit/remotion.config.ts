/**
 * Config for the OpenReceipt demo video edit.
 * Node.js render APIs ignore this file; the scripts/ helpers pass options directly.
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Paper bakes are read back at 100%; PNG stills must stay lossless.
Config.setStillImageFormat("png");
