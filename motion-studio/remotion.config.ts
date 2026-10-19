import {Config} from '@remotion/cli/config';

// PNG frames are required to preserve the alpha channel for DaVinci Resolve overlays.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuva444p10le');
Config.setCodec('prores');
Config.setProResProfile('4444');
Config.setOverwriteOutput(true);
