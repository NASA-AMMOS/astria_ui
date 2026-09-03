import Axios from 'axios';
import config from 'config.js';
import { IMAGE_TILER_SERVICE } from 'src/constants/api';
import { isAnnotation, isMosaic, isSingleFrame } from 'src/utils';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import urlJoin from 'url-join';

/* ASTRIA Backend */
export function astriaGetProductDescriptions() {
  return urlJoin(IMAGE_TILER_SERVICE, 'image_descriptions.xml');
}

/* Generic */
export function getBrowseImagePathForProduct(product) {
  if (config.data_provider_type === 'pds') {
    return getPropFromProduct(product, config.es_mappings.browse_url);
  } else {
    try {
      const path = getPropFromProduct(product, config.es_mappings.img_url);
      const pathComponents = path.split('/');

      // Swap 3-4 character length extension to PNG.
      const newFilename = pathComponents[pathComponents.length - 1].replace(/\.\S{3,4}$/, '.png');

      // Browse products with path A/B.IMG can be found at '../browse/A/B.IMG';
      const leadingPath = urlJoin(pathComponents.slice(0, pathComponents.length - 2));
      const browsePath = urlJoin('browse', pathComponents[pathComponents.length - 2], newFilename);
      return urlJoin(leadingPath, browsePath);
    } catch (err) {
      console.warn(
        `Unable to compute Browse path for product: ${getPropFromProduct(product, config.es_mappings.id)}`,
        product,
        err
      );
      return '';
    }
  }
}

export function getDownloadPath(path, product) {
  if (config.data_provider_type === 'pds') {
    return pdsDownloadPathForURL(path, product);
  } else {
    return datadriveGetOCSObjectDownloadPath(path);
  }
}

/* DataDrive */
export function datadriveGetOCSObjectDownloadPath(product) {
  const baseURL = config.api_endpoints.datadrive.data;
  const ocsURL = getPropFromProduct(product, config.es_mappings.img_url);
  const realPath = ocsURL.split('s3://')[1];
  return urlJoin(baseURL, realPath);
}

export function datadriveGetOCSObjectDownloadPathForOCSURL(ocsURL) {
  const baseURL = config.api_endpoints.datadrive.data;
  const realPath = ocsURL.split('s3://')[1];
  return urlJoin(baseURL, realPath);
}

export function datadriveDeleteFile(packageId, datasetId) {
  return Axios.delete(config.api_endpoints.datadrive.middleware + `/api/delete/` + packageId + `/` + datasetId, {
    withCredentials: true,
  });
}

export function datadriveGetOCSObjectDownloadPathForS3URL(s3URL = '') {
  const baseURL = config.api_endpoints.datadrive.data;
  const splits = s3URL.split('s3://');
  if (splits.length > 0) {
    const realPath = s3URL.split('s3://')[1];
    return urlJoin(baseURL, realPath);
  }
  return '';
}

export function datadriveGetLink(product) {
  const baseURL = config.api_endpoints.datadrive.client;
  const pkg = getPropFromProduct(product, config.es_mappings.package_name);
  const path = getPropFromProduct(product, config.es_mappings.path);
  const filename = getPropFromProduct(product, config.es_mappings.filename);
  return urlJoin(baseURL, pkg, path, `?selected=${filename}`);
}

export function datadriveGetThumbnail(product) {
  const baseURL = config.api_endpoints.datadrive.data;
  const datadriveThumbnailPackage = config.api_endpoints.datadrive.thumbnailPackageName;
  const ocsURL = getPropFromProduct(product, config.es_mappings.img_url);
  const realPath = ocsURL.split('s3://')[1];
  return urlJoin(baseURL, datadriveThumbnailPackage, realPath, 'med.png');
}

export function getThumbnail(product) {
  if (config.data_provider_type === 'pds') {
    return pdsGetPreviewImage(product, 'sm');
  } else {
    return datadriveGetThumbnail(product);
  }
}

export function getPreviewImageForProduct(product) {
  if (isSingleFrame(product) || isMosaic(product)) {
    if (config.data_provider_type === 'ocs') {
      return datadriveGetOCSObjectDownloadPath(getBrowseImagePathForProduct(product));
    } else if (config.data_provider_type === 'pds') {
      return pdsGetPreviewImage(product);
    }
  } else if (isAnnotation(product)) {
    return datadriveGetOCSObjectDownloadPath(product.browse_image || product.thumbnail);
  } else {
    // TODO catch PDS case?
    return datadriveGetOCSObjectDownloadPath(getPropFromProduct(product, config.es_mappings.img_url));
  }
}

/* PDS */

export function pdsDownloadPathForURL(productURL, product) {
  const baseURL = config.api_endpoints.pds.data;
  const releaseIdNum = getPropFromProduct(product, config.es_mappings.release_id);
  const query = `${productURL}${typeof releaseIdNum === 'number' ? `::${releaseIdNum}` : ''}`;
  return baseURL + query;
}

export function pdsGetPreviewImage(product, size = 'sm') {
  const baseURL = config.api_endpoints.pds.data;
  const browseUrl = getPropFromProduct(product, config.es_mappings.browse_url);
  const releaseIdNum = getPropFromProduct(product, config.es_mappings.release_id);
  const query = `${browseUrl}${typeof releaseIdNum === 'number' ? `::${releaseIdNum}` : ''}:${size}`;
  return baseURL + query;
}

export function pdsGetLink(product) {
  const baseURL = config.api_endpoints.pds.client;
  const uri = getPropFromProduct(product, config.es_mappings.uri);
  const query = `record?uri=${uri}`;
  return baseURL + query;
}

export function pdsGetDownloadPathForProduct(product, asJSON = false) {
  const baseURL = config.api_endpoints.pds.data;
  const productURL = getPropFromProduct(product, config.es_mappings.id);
  const releaseIdNum = getPropFromProduct(product, config.es_mappings.release_id);
  const query = `${productURL}${typeof releaseIdNum === 'number' ? `::${releaseIdNum}` : ''}${
    asJSON ? '?output=url' : ''
  }`;
  return baseURL + query;
}

export function pdsGetS3PathForImage(product) {
  const uri = getPropFromProduct(product, config.es_mappings.uri);
  const imgPath = uri
    .split(':')
    .pop()
    .replace(/^\/+|\/+$/g, '');
  let releaseId = getPropFromProduct(product, config.es_mappings.release_id, 'cumulative');
  if (releaseId !== 'cumulative') {
    releaseId = `r${releaseId}`;
  }
  return `${config.api_endpoints.pds.s3}/${releaseId}/${imgPath}`;
}

export async function pdsFetchDownloadPath(product, signal = null) {
  try {
    const result = await fetch(pdsGetDownloadPathForProduct(product, true), { signal });
    const json = await result.json();
    return json.url;
  } catch (err) {
    console.log('Error fetching PDS download path :>> ', err);
    return '';
  }
}

/* ASTTRO */
export function ASTTROGetLink(product) {
  const baseURL = config.api_endpoints.ASTTRO.client;
  const filename = getPropFromProduct(product, config.es_mappings.filename);
  try {
    const ASTTROImageId = filename.split('.')[0]; // remove the file extension for ASTTRO
    const site = getPropFromProduct(product, config.es_mappings.site);
    const drive = getPropFromProduct(product, config.es_mappings.drive);
    return urlJoin(baseURL, 'image', `${ASTTROImageId}?site=${site}&drive=${drive}`);
  } catch (err) {
    console.warn('Unable to get ASTTRO link for', product, err);
    return '';
  }
}

export function ASTTROGetLinkForTarget(target) {
  const baseURL = config.api_endpoints.ASTTRO.client;
  try {
    // Get target's imageId (filename), site, and drive
    const targetId = target.content.id;
    const site = target.dbContent.site;
    const drive = target.dbContent.drive;
    const filename = target.content.imageId;
    return urlJoin(baseURL, 'image', `${filename}?site=${site}&drive=${drive}&target=${targetId}`);
  } catch (err) {
    console.warn('Unable to get ASTTRO link for target', target, err);
    return '';
  }
}

/* Science Intent */
export function scienceIntentGetProductMetadata(activityID) {
  return urlJoin(config.api_endpoints.ScienceIntent.API, `/connections?foreign_key=activity_${activityID}`);
}

export function scienceIntentGetConnectionsByCampaignID(campaignID) {
  return urlJoin(config.api_endpoints.ScienceIntent.API, `/connections?foreign_key=campaign_${campaignID}`);
}

/* CAMP */
export function campGetAllCampaigns() {
  return urlJoin(config.api_endpoints.CAMP.API, 'spatial/published/strategic_targets?query=campaign&verbose=false');
}

export function CAMPGetLinkForTarget(target) {
  try {
    // Get target's imageId (filename), site, and drive
    const targetId = target.content.id;
    return urlJoin(config.api_endpoints.CAMP.client, `&selected=Tactical Targets,data.uuid,${targetId},go`);
  } catch (err) {
    console.warn('Unable to get CAMP link for target', target, err);
    return '';
  }
}

export function CAMPGetLinkForLatLon(options) {
  const { latLon, zoom = 20, text } = options;
  try {
    const hoverText = typeof text !== 'undefined' ? text : 'true';

    // Get target's imageId (filename), site, and drive
    return urlJoin(
      config.api_endpoints.CAMP.client,
      `&mapLon=${latLon.longitude}&mapLat=${latLon.latitude}&mapZoom=${zoom}&centerPin=${hoverText}`
    );
  } catch (err) {
    console.warn('Unable to get CAMP link for lat/lon', latLon, err);
  }
}

export function CAMPGetLinkForSiteDrive(product) {
  try {
    const site = product.site;
    const drive = product.drive;
    return urlJoin(config.api_endpoints.CAMP.client, `&selected=Rover Position,RMC,${site}_${drive},go`);
  } catch (err) {
    console.warn('Unable to get CAMP link for product', product, err);
    return '';
  }
}
