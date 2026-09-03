/**
 * Functions to define coordinate frame identifiers. These functions
 * do not handle conversion between frames, just the definition of
 * the available frames.
 */

import * as TargetFrame from 'src/utils/asttroLib/targetFrame.js';

export function frameId(frame, site, drive, pose) {
  switch (frame) {
    case TargetFrame.Site:
      return siteFrame(site);
    case TargetFrame.Rmech:
      return roverMechFrame(site, drive, pose);
    case TargetFrame.Rnav:
      return roverNavFrame(site, drive, pose);
    case TargetFrame.LocalLevel:
      return localLevelFrame(site, drive, pose);
    default:
      console.warn(`Unknown frame type ${frame}`);
      return null;
  }
}

export function siteFrame(site) {
  console.assert(site, 'Site not defined');
  return `SITE=${site}`;
}

export function localLevelFrame(site, drive, pose) {
  console.assert(site !== undefined, 'Site not defined');
  console.assert(drive !== undefined, 'Drive not defined');
  if (pose !== undefined) {
    return `LEVEL=${site},${drive},${pose}`;
  }
  return `LEVEL=${site},${drive}`;
}

export function roverNavFrame(site, drive, pose) {
  if (pose) {
    return `ROVER=${site},${drive},${pose}`;
  }
  return `ROVER=${site},${drive}`;
}

export function roverMechFrame(site, drive, pose) {
  if (pose) {
    return `RMECH=${site},${drive},${pose}`;
  }
  return `RMECH=${site},${drive}`;
}

export function isModelFrame(frame) {
  return frame && frame.startsWith('MODEL=');
}

export function modelFrame(modelFrameId) {
  console.assert(modelFrameId !== undefined, 'frame not defined');
  return `MODEL=${modelFrameId}`;
}

export function getRawFrame(frameId) {
  if (!frameId) {
    return null;
  }
  if (frameId.startsWith('SITE')) {
    return TargetFrame.Site;
  }
  if (frameId.startsWith('LEVEL')) {
    return TargetFrame.LocalLevel;
  }
  if (frameId.startsWith('ROVER')) {
    return TargetFrame.Rnav;
  }
  throw new Error(`Unknown frame: ${frameId}`);
}

export function getTargetFrame(target) {
  let site = null;
  let drive = null;
  // This method accepts either a SuperTarget or a Target. Use either the site/drive fields or RMC,
  // depending on what's available.
  if (target.site !== undefined && target.drive !== undefined) {
    site = target.site;
    drive = target.drive;
  } else if (target.rmc) {
    const rmcParsed = target.rmc.split(',');
    site = rmcParsed[0];
    drive = rmcParsed[1];
  }
  switch (target.frame || (target.content && target.content.frame)) {
    case TargetFrame.Site:
      return siteFrame(site);
    case TargetFrame.LocalLevel:
      return localLevelFrame(site, drive);
    case TargetFrame.Rnav:
      return roverNavFrame(site, drive);
    case TargetFrame.Rmech:
      return roverMechFrame(site, drive);
    default:
      console.assert('Not yet implemented');
  }
  return null;
}
