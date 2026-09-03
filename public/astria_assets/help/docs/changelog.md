#### {APPNAME} Changelog

## [8.6.0] (March 10, 2025)

### Bug Fixes

- Fix inconsistencies while opening images in ASTTRO ([MSGDS-8853](https://jira.jpl.nasa.gov/browse/MSGDS-8853))

## 8.5.0 (October 11, 2024)

### New Features

- **Add Multiple Scalebars**: Add multiple scalebars by hovering over a scalebar and clicking on the plus button. Remove unwanted scalebars by clicking the trash button. Scalebars are now persisted in the URL.

## 8.4.0 (August 13, 2024)

### New Features

- **Newer Mosaic Indicator**: A button will appear in the Image Metadata panel when a mosaic has a newer version available. A newer mosaic is defined as a mosaic with all of the same properties as the current mosaic except a newer sol and/or a multi-sol (when the current mosaic is not multi-sol). Click on this button to load the newer mosaic.
- **Default 100% Zoom Toggle**: Toggle option within the Zoom Settings in the bottom image toolbar that enables 100% default image zoom when loading new images. This option is off by default.

## 8.3.0 (April 2, 2024)

### Bug Fixes

- Fix image export for coreg overlays and spectral shots

## 8.2.0 (January 29, 2024)

### New Features

- **Overlay Additional Co-Registered Product Types**: Select additional base image and RDR products to overlay for a given co-registered image. Access these controls through the three dot menu found on each co-registered image result.

### Enhancements

- Unify layer controls present in the Layers tab and the other specific overlay tabs, specifically the Co-Reg and Spectra tabs.
- Add SHERLOC quicklook best image product type preferences of ZFF and MSC to M20 config.
- Implement feature flags for better multi-mission support.

### Bug Fixes

- Fix opening of spectral files in Datadrive

## 8.1.0 (September 1, 2023)

### New Features

- **Target Search**: Browse targets by sol from the Target search tab on the left. Clicking on a target result will load all the images associated with the target by metadata. Additionally, below the images of the target will be grouped images of other related targets. These targets are related by known prefixes like "LD\_\*" and sol suffixes.
- **Map Search**: Search for images by their geospatial location from the Map Area filter in the Search tab. Draw an area on the map and specify the region around the search that the image could have been acquired from to create a manageable set of results. Filters and more specific distance shape filters are available to aid in refining the search. WKT and GeoJSON from CAMP or other GIS software can be pasted in the shape editor and used for search. The resulting images can be further refined with other filters in the Search tab. This geospatial search capability relies on SciLo footprints which are currently limited to NavCam, Hazcam, ZCAM, and SCAM.
- **RDR Search**: Browse RDR products by sol from the RDR search tab on the left. Clicking on a result loads the RDR with a reasonable base image underneath.
- **Multi-hop Co-Registration Results**: The co-registration tab now displays "multi-hop" results. Multi-hop results are chained co-registered images that enable the overlay of images (and therefore spectral shots) with disparate spatial resolutions such as PIXL on a Navcam through images with intermediary resolutions such as ZCAMs and WATSONs. Note that the more disparate the resolutions are and the more hops the overlay image must go through, the lower the accuracy of the resulting overlay.
- **Export Result Lists**: Export a subset of metadata from various result lists within {APPNAME}. This includes search results, related imagery subtabs, and co-registered image layers. Click on the download button next to the number of results to open the export modal. Only the currently loaded pages of results will be included in the metadata export. Export options include OCS URLs, filenames, {APPNAME} URLs, PNG/JPG image URLs, and a JSON file with a subset of OCS metadata included. Note that for the full set of metadata you should refer to the actual product in {APPNAME}/OCS.
- **Add Image Layers from URL or Path**: Add image overlays from {APPNAME} URLs, S3 paths, and filenames. To do so, click on the three dot menu to the right of the active overlays header within the Layers tab and select "Add Layers From URL or Path". Multiple layers can be added at once by separating each layer with a comma.
- **Animate Layers**: Animate image layers from within the Layers tab. To create an animation, add one or more image layers on top of the base image and click on the three dot menu to the right of the active overlays header within the Layers tab and select "Animate Layers". In combination with the previous two features you can now easily add arbitrary images to create blink animations or short video segments.
- **Open Scene in PIXLISE**: Open co-registered imagery and spectral observations in PIXLISE from the Spectra tab.
- **Role Based Search Filter Presets**: Select role-based search filter presets from the search filter customization menu.
  These presets can be further customized for your instance of {APPNAME}.
- **Left Side Tabs Redesign**: Reorganization of the search tabs on the left side of {APPNAME} to make room for new search functionalities.

### Enhancements

- Improved spectral shot rendering performance, scaling, and quality
- Use new co-registration queries for improved loading performance and reduced load on CRISP
- Use RAD, RAS, or RZS when opening a product in ASTTRO
- Option to save a fairly high resolution export of an annotation to OCS during the annotation saving process
- Improvements and fixes to side panel resizing behavior
- Indicate when an image result is a thumbnail product
- Improved responsiveness and availability of result list controls

### Bug Fixes

- Fix issue with initial Spectra Tab loading indicator ([Github #1465](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1465))
- Fix edge cases related to loading stale data ([Github #1443](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1443))
- Improve preservation of source image bounding box visibility preference ([Github #1054](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1504))

## 7.7.0-patch-1 (June 8, 2023)

### Bug Fixes

- Invert the ICM name for CRUST bulk translate query ([Github #1457](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1457))
- Versioning fixes of Coregistration products, including reconciling naming collisions
- Split CRUST spectral queries to speed loading of image metadata

## 7.7.0 (February 23, 2023)

### New Features

- **View Spectral Shots on Context Image and Other Images**: Visualize spectral shots taken on the current base image or taken on other images from the Spectra tab. Spectral shots will be available for visualization if the current base image is the context image used for the observation or if the shots can be co-registered from other context images.
- **Interactive Source Image Bounding Box Selection**: Overlay the bounding boxes for mosaic source images in the image viewer by enabling "Show Bounding Boxes" in the Source subtab of the Related tab. Click on a bounding box in the image to filter the source images list to that image. The previous behavior of filtering using a data cursor is still supported when an IDX product is available. Note that mosaics produced before G7.7 may not have bounding boxes available.
- **Display Associated Mosaics for Selected Source Image**: View the mosaics associated with your selected source image inside of the Source subtab of the Related tab. To enable this functionality, toggle on the "Show Mosaics Associated With Selection" option inside of the view menu above the source images. Source images can be selected by clicking on a bounding box in the image viewer or by placing a data cursor on a point in the image when an IDX product is available.
- **Star OCS and VICAR Fields for Quick Access**: Star metadata fields in the Image Metadata and VICAR Label Explorer sections. View these fields from inside the Image Metadata section by selecting the "Starred" option from the dropdown at the top of the section.

### Enhancements

- Add option to enable interpolation for coregistered images and spectral shots
- Add Navcam Finder, Navcam Colorglyph, WATSON Closerlooks (MSSS), and ACI Closerlooks (MSSS) categories to Mosaic Browse
- Add image result title view option to Related -> Source, Related -> Overlapping, and Co-Reg result lists
- Add Date Created sort option and filter
- Add Sun Angle filter (SOLAR_AZIMUTH in VICAR label)
- Add text content filter for Mosaic Browse
- Add option to disable EDR group tooltip for filename results
- Move Target Name filter up in the default Image Search filter list for increased visibility
- Add Completion Status filter (PRODUCT_COMPLETION_STATUS in VICAR label)
- Add instrument and data cursor filters to the Co-Reg result list
- Remove co-reg bounding box semi-transparent fill when hovering over a co-reg result
- Better navigation bar responsiveness

### Bug Fixes

- Fix for issue where incorrect data would load when switching between images rapidly ([Github #874](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/874))
- Fix for downsample filter by simplifying the filter to a basic text input ([Github #874](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/874))
- Fix rare issue with dragging RDRs to re-order during RDR loading ([Github #1172](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1172))
- Fix issue with Science Intent Keyword filter autocomplete ([Github #1421](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1421))
- Use Event.composedPath() instead of Event.path which is now deprecated in Chrome.

## 7.6.1 (January 30, 2023)

### Bug Fixes

- Use Event.composedPath() instead of Event.path which is now deprecated in Chrome.

## 7.6.0 (October 7, 2022)

### New Features

- **View Image in Orbital Context**: View rover and image data cursor location in orbital context in the Map tab. Visualize the footprint of the current image if one is available. Control click on the map to estimate the location of the orbital position within the current image. Overlay the rover traverse, waypoints, strategic traverse, strategic annotations, and planned targets. Click on targets on the map to view target metadata.
- **Customize Image Search Facet Visibility and Order**: Control the visibility and order of facets in Image Search from within the new customization widget above the list of facets. Preferences are stored in the browser's local storage so will persist across page refreshes but will not transfer across machines.
- **Invert Searches**: Invert search facet values in Sol Browse and Image Search. Individual search facets can be inverted when the facet has active values or in special cases where the facet has defaults (Object Type & Tiles). For example, a search for [NOT: Sequence ID: ncam001*] and [NOT: Sol: 0 – 100] will display all products with sequence ID values that do not match ncam001\* and also do not fall within sols 0 – 100. In Sol Browse you can invert search facet values using the "Invert" button that will appear when applicable. In Image Search you can invert search facet values using the "not" button that appears to the right of the facet title.
- **Open Products in New Tabs**: Open products from searches, history, and related images in new tabs using the "open in new tab" button that appears on the right side of image and filename results.
- **Support Mosaic RTT Metadata**: Make use of new mosaic Round Trip Tracking (RTT) values including Activity Name, Activity ID, Activity Notes, Sequence ID, Target ID, and Target Name. RTT values for a mosaic are the set of RTT values from the mosaic's input images. For example, if the images making up a particular ZCAM mosaic came from two different sequences, the value of the mosaic's "Sequence ID" field would be those two sequences, ex: ["zcam00012", "zcam00013"]. Mosaics can now be searched by Activity Name, Activity ID, Sequence ID, Target Name, Campaign, Goal, and Task. Activity Name, Sequence ID, and Target Name will appear in Mosaic Browse results when values are available.
- **Select RDR Version and Special Processing Flag**: Select which version and special processing flag type of an RDR you are viewing and using for measure, scale, and overlapping image finder through the operator controls for individual RDRs.

### Enhancements

- Prefix ECAM instruments in the Instrument facet with ECAM for more convenient sorting
- Select different base image versions when available
- Filter the target list to more easily find targets. Show all and hide all are affeceted by this text filter.
- Improve deletion process for user drawings by removing the deletion button from within the drawing editor, renaming the "save" button to "save drawing", and adding a delete button to the drawing layer rows in the Draw and Layers tabs. This change aims to reduce the chance of accidentally deleting the entire user drawing instead of deleting individual drawing objects.
- Collapsible sections in {APPNAME} such as Image Search facets and the sections within the Image tab now have their collapsed state preserved in local storage to allow users to more effectively preserve their application view customizations
- New "Is DOY" and "Year" facets within Image Search to allow users to effectively search on DOY products by selecting "true" for "Is DOY" and specifying a year
- Select from color and stroke width presets when editing objects in user drawings
- New RMC facet in Image Search that allows the user to input a single value for site and a single value for drive. Each value is optional. The RMC facet can be used in combination with the existing Site and Drive facets.
- Use the latest version of each SciLo footprint
- Add keyboard shortcut guidance for the measure tool inside of the tooltip for measure in the application header
- Preserve operator control selections in the URL
- Hide mosaic image result secondary time label (top right) since no relevant time is available
- Change Tile facet "Reconstructed Images" label to "Reconstructed / FDR"
- New "Coreg Eligible" facet for finding images eligible to participate in co-registration
- Open Co-Reg results in new tabs from within the Layers tab

### Bug Fixes

- Fix disappearing VICAR label values on hover for ZCAM strategic closerlook mosaics ([Github #1256](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1256))
- Fix white lines appearing on the image while dragging ([Github #1257](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1257))
- Fix for activity name RTT labels not appearing when requested for Image Search image result labels ([Github #1258](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1258))
- Fix image histogram styling issue ([Github #1212](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1212))
- Gracefully handle failed ray projections during IFOV for single frame images computations ([Github #1255](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1255))
- Ensure Image Search dynamic histogram slider is properly reset when the search chip is cleared ([Github #975](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/975))
- Properly handle numerical values in Image Search top hits facets ([Github #1195](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1195))
- Wrap long target names in target metadata header ([Github #1235](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1235))
- Fix for image loading indicator not always clearing when quickly switching images ([Github #1289](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1289))
- Fix for sol display in image thumbnail results when time1 (sol) is an array of values ([Github #1291](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1291))
- Ensure draw tab is selected and visible when user clicks the draw button in the header ([Github #1282](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1282))

## 7.5.4 (January 30, 2023)

### Bug Fixes

- Use Event.composedPath() instead of Event.path which is now deprecated in Chrome.

## 7.5.3 (September 19, 2022)

### Bug Fixes

- Additional minor updates in support of OSD operations.

## 7.5.2 (August 9, 2022)

### Bug Fixes

- Updates OSD and sets subpixel rounding to always for all browsers to get rid of tile gap issue seen in Chrome

## 7.5.1 (July 11, 2022)

### Bug Fixes

- Minor fixes to styling bugs and loading states

## 7.5.0 (June 3, 2022)

### New Features

- **Mark Features in Images**: Use features to mark areas in images with Science Intent Keywords. Indicate your level of confidence in features you mark, add notes, and share these features with others.
- **Product Family Descriptions**: View product family descriptions for the base image in a new section in the info tab. View these descriptions for RDRs and coreg products via a “read more” button in the active overlays tab and in their respective tabs.
- **Active Image Tabs Overhaul**: Reorganization of the tabs on the right side of {APPNAME} to make room for new functionalities and improve organization of various existing functionalities.
- **Image Browsing History**: Quickly load recently viewed images using the Image History feature in the top of the app navbar. Open images directly in the {APPNAME} tab or in a new tab. History is limited to 100 images and is stored locally in the specific browser you are using so the history will not transfer across different browsers or machines.
- **Image Loading Progress Indication**: Image loading progress indication in the lower icon bar. This includes the base image, image stretches, RDRs, and coregistered items. Hover over the loading indicator for details regarding which layers are still loading.

### Enhancements

- Support mosaics with SITE and LOCAL_LEVEL frame surface projection model to derive scale using an XYZ RDR to derive scale
- Automatically preserve active targets on image switch if active targets are found in the next image
- Zoom to the bounds of drawings that have been added to the viewer
- New Image Search view option to sort by sol
- New Sol Browse and Image Search view option to use target_name_rtt as the top right label for image results when available
- Automatic retry of failed and timed-out image pyramid and tile requests which should result in the eventual loading in of in progress mosaics, long co-registration jobs, and long image stretches.
- Use the following products for measuring in this order: XYZ, XYM, XYR
- Use the following products for retrieving orbital coordinates for the overlapping image finder: XYR, XYZ, XYM, XOZ
- Pan while adding and editing shapes for a drawing or feature by holding down option
- Update to use ElasticSearch 7. Users will see 75k+ in result counts over 75000. If you need to see the exact count of results over 75k you can enable this mode from view options in both Image Search and Sol Browse. Note that this mode will likely become slower over time as the limited result count mode (default and still gives correct searches, just not exact count) is the most optimized query mode.
- View "Orbital Coordinates" in the Image Data Finder when available. This includes Easting, Northing, Elevation, Longitude, and Latitude and a link to the location in CAMP
- Optimizations for large coreg results including result pagination
- Add radius (cm) and result pagination to Overlapping Image Search
- Add Help article for Source Image Finder
- Add toggle in Source Image Finder to auto add IDX layer at 50% opacity if available
- Add new mosaic gathering category for ZCAM mosaic images
- Show coreg bounding box on hover in Active Overlays

### Bug Fixes

- Fixes and better support for viewing the metadata for specific items. Fixes for DN querying for co-registered images. ([Github #1161](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1161))
- Fix range facet height jumpiness during search loads. ([Github #1161](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/1197))
- Relabeled Fundamental Data Record (FDR) images as "Reconstructed Images" to more accurately reflect their origin ([MSGDS-7341](https://jira.jpl.nasa.gov/browse/MSGDS-7341))

## 7.4.0 (March 3, 2022)

### New Features

- **Consolidate Instrument List**: The "Instrument" facet in Sol Browse an Image Search now uses a new metadata field that consolidates the list of instruments into their respective instrument families. For example, "Navcam Left", "Navcam Right", "Navcam Mosaic", "Navcam Mosaic Anaglyph", etc are collapsed into "Navcam". The functionality of the legacy "Instrument" facet can now be accessed from the "Instrument ID" facet from both Sol Browse and Image Search.
- **Perform Latest X Searches**: Search for the latest X sols or helicopter flights where X can be 1, 5, or 15. The default behavior is now named "Custom Range" and allows the user to specify any range of values. These "latest X" searches are preserved in the URL and will always fetch the current "latest X" values.
- **View Top Hits for Input Facets**: View the top 50 hits for various input facets such as Target Name, Sequence ID, Activity Name, etc. These top hits and the text input autocomplete are restricted by your currently active facets. For example, this allows users to view the top 50 targets (sorted alphabetically) that match a certain sol range and instrument selection.
- **View Scalebar on SHERLOC ACI, SHERLOC WATSON, and SuperCam RMI Images**: Scalebar available for Single frame SHERLOC ACI, SHERLOC WATSON, and SuperCam RMI images with varying degrees of uncertainty.
  - WATSON images are supported if their FOCUS_POSITION_COUNT indicates a working distance between 1.8cm and 220cm.
  - ACI images are supported if their FOCUS_POSITION_COUNT indicates a working distance between 40mm and 56mm.
  - RMI images are supported if their INSTRUMENT_FOCUS_DISTANCE is less than or equal to 31m however accuracy will likely be better the closer the target is.
- **Show and Hide Individual Targets**: Individual tactical targets can now be shown or hidden from the targets sub-tab in the Overlays tab. These visibility states are preserved in the URL.
- **View Associated Mosaics and Reconstructed Products**: View mosaics associated with an image or reconstructed products associated with a tile from within the "Associated Mosaics" widget in the Image tab.
- **Stretch User Uploads and Image Quicklooks**: Image Stretch is now available for all User Uploads and Quicklooks that are in PNG/JPG/TIFF format.
- **Image Gamma Updates**: Improvements have been made to the handling of colorspace metadata. Contrast and brightness improvements may be visible in the new default processing of many images.

### Enhancements

- Expand product type list in "best image" algorithm to include more products. The preference order is now: FDR, TDR, EBY, EDR, EVD, EZS, ECM, ECV, ECZ, RAS, RAD, RZS, ERD, ECR.
- Use 7 decimal places for Lon/Lat in the Overlapping Image Finder
- New "Image Kind" facet with options to select from "Video Frame", "Recovered", "Z Stack", and "Normal"
- Add Helicopter flight number facet to Image Search. Display Helicopter flight number when appropriate in image results and image metadata.
- Add Window ID facet
- Add Downsample facet
- Add Stereo facet
- Choose projection before eye in "best image" algorithm
- Add a small yellow dot next to facets in Image Search when they have any active values
- Add close button to date selection modals
- Improve when possible the range estimation used in sorting the overlapping image search results. The range value is now displayed for each result.
- Filter Overlapping Image Search results by range and instrument
- Use the following products as fallbacks for resolving XYZ in Overlapping Image Finder: [XYR, XYZ, XOZ]. The use of XOZ as a fallback greatly expands the areas available for use with the Overlapping Image Finder and brings the capability to RMI images which otherwise have no XYR/XYZ.
- Filter out video frames and the current base image group in Overlapping Image Finder
- Disable the backprojection cursor in resulting images across different site/drives in Overlapping Image Finder due to current inaccuracy (may be re-enabled in the future once accuracy is understood and improved)
- Add helper text to explain what “placing an image data explorer cursor” means in the Source Images and Overlapping Image Finder widgets
- Skip attempted preservation of reconstruction counter when switching images

### Bug Fixes

- Fix facet text input autocomplete for strings containing slashes ([Github #1068](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/1068))
- Fix issue loading searches opened from {APPNAME} in new tabs with array-based facet values ([Github #1074](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/1074))
- Use appropriate local or environment authentication when posting Cloudwatch telemetry from the Node server ([Github #1059](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/1059))
- Fix issue with ECAM Tiles facet values not always clearing ([Github #933](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/933))
- "Now" button in search date selector changed to use local time instead of UTC ([Github #1042](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/1042))
- Reduce load on Science Intent API by restructuring a query used to fetch tasks and associated connections and goals

## 7.3.0 (October 22, 2021)

### New Features

- **Finding Related Images Based on Latitude and Longitude**: Search for images that intersect particular latitude and longitude coordinates and points within an image. This is enabled by combining the XYZ overlay, PLACES, and SciLo data services. Currently the only supported instruments are Navcam, Mastcam-Z, Front and Rear Hazcams, and SuperCam RMI.
- **Browse Commonly Relevant Mosaics**: Browse an automatically curated set of mosaics across the entire mission in a timeline view. Search using command/control + F through each category of mosaics to navigate around the list of images.
- **Custom RDR Rendering**: Dynamically control how RDRs are visualized by modifying the parameters used to generate RDRs. Access these controls from the settings icon in each RDR card. Note: these parameters are not currently stored in the URL.

### Enhancements

- Significantly improved search speed by requesting less metadata for each search result. Note that now image metadata must be loaded on demand when products are viewed.
- Ability to manually input line and sample into Image Data Explorer and Overlapping Image Finder.
- View site and drive of an image in CAMP
- Adjust the opacity of active RDRs, drawings, and co-registered images and spectral shots from their respective subtabs. Previously a user could only adjust the opacity of overlays from the Active subtab.

### Bug Fixes

- Fix issue where measurements, the data cursor, co-registered images, targets, and drawings would be cleared after a base image switch ([Github #972](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/972))
- Fix for multi-hop co-registered image bounding box display bug ([Github #957](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/957))
- Fixes for co-registered spectral shot display ([Github #959](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/959))
- Fix ElasticSearch querying strategies to improve search performance ([Github #994](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/994))
- Fix for zoom and home controls not working for GIF products ([Github #976](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/976))
- Sort search facet item lists by aliased value instead of OCS value ([Github #990](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/990))
- Better handling of bad values in drawing editor inputs ([Github #979](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/979))

## 7.2.0 (July 30, 2021)

### New Features

- **Draw on Image Quicklooks and User Uploads**: Drawing now enabled for Image Quicklooks and User Uploads.
- **Source Image Display**: View the source images for mosaics and reconstructed images in the "Source Images" panel in the Image tab. Click on a source image to open it in a new {APPNAME} tab. If the base image has an IDX product you can find the source image used for a particular pixel in the base image by placing an Image Data Explorer cursor and toggling on the "Filter to Data Cursor" option.
- **Multi-Hop Co-Registration**: Added support for finding multi-hop coregistration solutions. This is done by searching for images coregistered to the images that are coregistered to the current base image. For those images, the application attempts to find a multi-hop solution to warp it onto the base image.
- **Improved Image Rotation Support**: Image rotation now compatible with Image Data Explorer cursor, targets, and measurements. Current rotation is displayed in the bottom toolbar and is preserved in the {APPNAME} URL. Drawings, spectral shots, and image exports are not currently compatible with image rotation.
- **Display GIF Quicklooks**: View GIF quicklooks in {APPNAME} with panning and zooming support.

### Enhancements

- Sort search facet list items alphabetically instead of by result count
- Case-insensitivity for search inputs
- Preserve opacity when preserving active RDRs
- Search view option to display activity name (when available) or sequence ID instead of instrument name
- Drag search facet histogram endpoints to set input ranges
- Add activity name search facet
- Add IMAGE_ID search facet
- Add keyboard shortcut documentation for opening images in new tabs and windows
- Open the current image a new {APPNAME} tab from the "View In" menu in the Image tab
- View product metadata for both the base image and ICM of co-registered images
- Improve dash and dotted drawing geometry stroke scaling
- Use monospace font for Image Data Explorer values
- Change "OCS Created By" labels to "Owner"
- Update client dependencies for security and maintenance purposes
- Disable image flipping and rotation keyboard shortcuts to prevent accidental use
- Pan the image while measuring by holding option on mac or alt on windows

### Bug Fixes

- Sanitize drawing filenames ([Github #885](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/885))
- Remove duplicate autocomplete suggestions ([Github #840](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/840))
- Update target listing on each base image change ([Github #863](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/863))
- Fix duplication of geometry edit handles during drawing ([Github #832](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/832))

## 7.1.0 (April 12, 2021)

### New Features

- **Display Targets**: View 2D, 3D Point, Az/El, amd Proximity targets in {APPNAME}. Targets are limited to the site and drive of the base image and are further constrained by base image bounds. View metadata for each target, open targets in ASTTRO and CAMP, and open the target's source image in a new {APPNAME} tab. Your selected target is also sharable via URL.
- **Save and Reload Searches**: Save your “Sol Browse” and “Image Search” filters under a single saved search that you can reload, rename, overwrite, and delete. These saved searches are only accessible to the user that creates them.
- **Improved Image Export**: Image export now respects the aspect ratio of the source image. You can now export what you see in the image viewer at low, medium, high, and actual resolutions. Very large images and mosaics may be too large for the browser export and a non-blocking warning will appear when {APPNAME} believes this is the case. If you do see this warning consider exporting the image at a lower resolution or downloading the image as PNG from {APPNAME} or DataDrive. Additionally, all export sizes besides "Actual" will likely resample the image. The "Actual" export size should be identical to the Browse PNG produced by IDS except for the default image stretch applied by the {APPNAME} image tiler plus any images stretch you may have performed. You can also now optionally export drawings, measurements, targets, and az/el rulers on top of your base image and image overlays.

### Enhancements

- Sort facets in Image Search alphabetically
- Added a "now" button in datetime facets
- Added ERT and Last Updated Cutoff filters to Sol Browse
- Support both "I" and "S" for SHERLOC Imaging (WATSON) mosaic alias.
- Log application config to dev console for easier deployment debugging.
- Improve date input parsing to allow for optional Z and other formats.
- Added "activity_name_rtt" and "activity_notes_rtt" to m20-edr-rdr default metadata display.
- Added "Size (Bytes)" sort to search.
- Swap ocs_owner for ocs_created_by for identifying products and annotations

### Bug Fixes

- Fix incorrect Trapezoidal geometry best image value. ([Github #764](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/764))
- Fix range facet switching input values when min value has fewer digits than max value ([Github #790](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/790))
- Fix for ERT and Last Updated Cutoff date pickers closing accidentally in rare cases ([Github #774](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/774))

## 7.0.0 (February 17, 2021)

### New Features

- **Cloudwatch telemetry logging**: {APPNAME} frontend now logs key performance and usage metrics, warnings, and errors for better diagnostics.
- **View PDFs**: View PDFs directly in {APPNAME} as well as the accompanying product metadata.
- **In-App Help System**: Browse introductory information and how-to guides within {APPNAME} through the "User Guide" available in the "Help" menu.
- **Image Search Facet Help Tips**: View helpful information about each search facet by hovering over the ? icon that appears next to the title of each search facet.
- **Download Full Resolution Image as PNG**: Download the full resolution Browse image version of m20-edr-rdr underlays and m20-mosaics. Note: m20-mosaics may not always have a Browse image available.
- **Active RDRs Preserved Across Images**: {APPNAME} attempts to preserve active RDR products across image switches. Functionality is on by default but can be disabled from the RDR sub-tab in the Overlays tab.
- **Search for User Drawings**: Search for User Drawings from the Image Search tab by including the "Drawing" in the "Object type" facet. Drawings will appear in search results. When clicked on, the image that the drawing was made on top of will load. Drawings can be searched by standard OCS fields (filename, OCS owner, ocs path, etc) as well as drawing title, description, and text content which are available using the "Drawing Text" facet.
- **Earth Received Time and OCS Last Updated Time Cut-off Facets**: Search for products that have an ERT or Last Update Time after a certain time. This feature can help you find products that were received on the most recent downlink. You can also now sort products by ERT.

### Enhancements

- Dynamic and improved measurements:
  - Click on a measurement to edit the measurement. Once editing, drag a measurement endpoint or drag the entire measurement.
  - Measurement value and connecting line update as you place or edit the measurement.
  - Visually overhauled measurements for better consistency and clarity.
- Improved the "best image in exposure group" determination:
  - {APPNAME} now uses a single list of fields to determine which image in an exposure is the "best" representation of the exposure to show in search results.
  - The "best image" fields are the following (ranked by highest priority): Image Size (Full vs Thumbnail), Eye Type (Left, Right, Mono, etc), Producer, Special Processing Flag, Stereo Counter, Reconstruction Type, Reconstruction Counter, Downsample, Compression, Projection, Geometry, Product Type, Version.
  - All of these "best image" fields are exposed as dropdowns in the "Image" tab in the right sidebar. A dropdown will be present only if there is more than one option available. Dropdowns are presented in descending priority order, meaning that dropdowns filter the results of the fields below them.
  - Added aliases for Reconstruction Type, Compression, mosaic instrument IDs, and Producer.
  - Alias geometry values. "Raw" -≥ "Original", "Nominal" -≥ "Linearized".
- Object Type facet improvements:
  - Facet/filter now defaults to "m20-edr-rdr" and "m20-mosaic", meaning that users now have to opt-in to see "m20-quicklook", "m20-mv-user-upload", and " m20-mv-annotation".
  - Object type values now aliased to more human friendly names.
  - Facet moved up in the Image Search facet list.
- Added an "All" option when viewing image metadata to view all OCS metadata (besides the VICAR label) found for the current product. The existing curated list of metadata has moved under the "default" option and is still the default behavior.
- Drag and drop overlays to re-order in the "Active" sub-tab in the "Overlays" tab. Up and down arrows have been removed.
- Drawing Improvements:
  - Copy and paste shapes using control/command c/v. Alternatively use the new "duplicate object" button in the object editor panel.
  - Ability to delete polygon points by double clicking on the polygon to enter edit mode, clicking on a point, and pressing delete.
  - All pen drawing components are now automatically selected after the user finished the pen drawing.
- Added number of lines, number of samples, number of bands, and data type to default metadata for m20-edr-rdr and m20-mosaic.
- Added secondary instrument facet.
- Append "mosaic" to the end of mosaic instrument and secondary instrument aliases.
- Use new OCS "tile_flag" metadata for m20-edr-rdr to determine if a product is a tile.
- Added thumbnails for non-IMG products in search.
- VICAR Label Explorer now uses tabular numbers for better readability.
- Updated scalebar hint from "no data" to "unknown" for situations where the pixel does not have an XYZ value.
- Search results are now sub-sorted by filename to ensure that ECAM tiles appear in ascending order within their tile group.
- Include all "Default" fields in the "All" metadata view so that specific VICAR fields get included in the "All" view. Previously the "All" view would only include the top level OCS fields (with the exception of the VICAR label) present in the object being viewed.
- Mosaic scalebar now makes use of the XYZ product when available for more robust scale computations.

### Bug Fixes

- Restricts searches for co-registered overlays to only search using the RAS or RAST items in the current search product group. ([Github #653](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/653))
- Only show Image Data Explorer (DN) cursor value when a cursor is active. Show loading message in Image Data Explorer when still fetching image group. Fix method of identifying base images so that RZS is properly included. ([Github #651](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/651))
- Fix for bad Campaign facet query ([Github #646](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/646))
- Use current OCS packages when fetching the image group. ([Github #627](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/627))
- Improved performance when typing in Drawing title and description fields ([Github #599](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/599))
- Added CAHV, CAHVOR, and CAHVORE camera model support specifically for determining iFOV for scalebar computations. ([Github #519](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/519))
- Fix LMST formatting ([Github #536](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/536))
- Image stretch bounds checking fix ([Github #485](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/485))
- Fix case where drawing could be accidentally discarded without warning ([Github #398](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/398))
- Fix for drawing letter-spacing getting stuck after inputting 0 ([Github #540](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/540))
- Fix for hidden overflowing VICAR label text([Github #676](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/676))

## 6.8.1 (January 11, 2021)

### Features

- Image Data Explorer Updates
  - Allow EDR products to be queried in Image Data Explorer
  - Active base image automatically added to active Image Data Explorer
  - Current mouse position moved to bottom image viewer toolbar
- Improved Viewer Toolbar
  - Toolbar responds to smaller window sizes by moving items into an overflow menu
  - Toggle current mouse position between line/sample and az/el when available
  - Added image viewer settings menu. All menu options are persisted in localstorage. Menu options:
    - Toggle az/el guide visibility (on by default)
    - Toggle scalebar visibility (on by default)
    - Toggle image navigator/minimap visibility (on by default)
    - Toggle image smoothing (off by default)

### Bug Fixes

- Use product_type instead of image_type when looking for an RNG product to use for measurements. Use latest version of matching products for measurement and scale queries. ([Github #602](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/602))

## 6.8.0 (November 17, 2020)

### Features

- Spectral shot display via CRUST
  - Context images now list available spectral shot sets under the `Co-Reg` sub-tab
  - Spectral shots display as pink dots appropriately overlayed on the image
  - The complete set of shot numbers and corresponding line/sample can also be viewed
    - Hovering over an entry highlights the corresponding shot on the image
    - This list can filtered by the current view (on by default)
- DN Labeling and changes
  - Redesigned DN selection panel
  - Uses updated DN cursor API to get labels for DN values
  - Select which products to request instead of requesting all products every time
  - Filters list of DN products by overlay_id and version
  - Ability to toggle on/off automatically adding RDR overlays to DN product list

### Bug Fixes

- Fixed crash for when CAMP Campaign request returns no Campaigns ([Github #491](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/491))
- Preserve relevant url parameters when opening a co-registered image in a new tab ([Github #471](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/471))
- Filter RDR Overlays to latest version to avoid duplicates
- Fix overlays sometimes not appearing for products that have overlays ([Github #510](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/510))
- Fix bug where custom products would not load via url ([Github #514](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/pull/514))

## 6.7.0 (October 27, 2020)

### Features

- Base image selection has been significantly reorganized to increase usability and efficiency.
  - Base image selection is now performed in the “Image” tab (formerly "Info") in the right side panel and is accomplished using the applicable dropdowns/toggles to select among the various options. The current options are eye, geometry, and product type. Once any option is selected a new base image will be automatically loaded.
  - A future update (likely 6.8) will add downsample, special processing flag, and potentially other options.
- Co-registered images now use the correct zoom levels to provide the highest level of detail available.
- EDR group tooltip usability improved by increasing hover delay, shrinking the tooltip row sizes, and disabling pointer events on the tooltip for easier hover-out.
- Search inputs such as sol input, filename input, generic range inputs, and generic text boxes have been given a dedicated search button. This was done to address the case where users aren't aware that they can hit enter in the search boxes to trigger search.
- Compact filename mode is now much more compact.
- Use new RTT metadata field for Target Name
- "Open in ASTTRO/Datadrive" and “Download” have moved to icon buttons in the Image tab.
- All image overlays (RDRs, Drawings, Co-reg) can now be toggled on and off by clicking on the card row. This is in addition to clicking the check/close icon.
- Added “Special Processing Flag” facet to Image Search.
- Added OCS Path facet to both Image Search and Sol Browse.
- Added a help menu in the navbar with support, link to user guide, and keyboard shortcuts.
- Added ability to reset application to defaults (which clears all locally stored active tabs and panel sizes).
- Added keyboard shortcuts for:
  - Previous/next image ("[" and "]"). One caveat is that if the user reloads the page and the image is not in the initial set of search results the previous/next image selected by the shortcut will be the first available result.
  - Add a new measurement using "m".

### Bug Fixes

- Fixed crash when loading app with deprecated url parameter ([Github #417](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/417))
- Fixed issue where annotation layer opacity changes would trigger unsaved changes state on the annotation ([Github #409](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/409))
- Fixed issue where DN cursor would not clear after switching to certain base images ([Github #417](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/417))
- Fix to allow thumbnails to be viewed as main image ([Github #394](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/394))

## 6.6.0 (September 11, 2020)

### Features

- Co-Registration
  - I5 Case: View co-registered images as overlays
  - I6 Case: Access DN values of co-registered images and their associated RDRs
  - Open co-reg images in new {APPNAME} tab as main image with the previous base image overlaid as a co-reg image (if possible)
  - Preview bounding boxes of co-registered images (on image card hover)
  - Option to filter co-reg images to current viewport, on by default
  - Dropdown to select co-reg images aligned TO or FROM the current base image. Defaults to TO.
  - Toggle co-reg images on and off by clicking on the image card. Also applies to all other overlay cards.
- Details pane in right sidebar now always reflects the active base image. Previously the details pane would only reflect the initial image result selected from the left search sidebar
- View metadata, VICAR label, and DN values for RDRs and co-registered images using an info icon next to each overlay
- Image stretching overhaul
  - Dynamic Image Stretching Mode: Preserves full dynamic range of the image by requesting new image tiles stretched to the user provided DN extrema stretch values or percentiles
  - Preview Stretch Mode: Roughly adjusts contrast of pre-stretched image tiles on the client, allows for quick stretch but does not preserve full dynamic range!
  - Displays original image histogram
  - Option to persist any kind of stretch across images
- Search UI Overhaul
  - Removed ReactiveSearch dependency and rewrote search UI to implement needed search management behaviors. Needed to support various features and fix many egregious bugs caused by ReactiveSearch.
  - EDR Grouping Part 1:
    - Group EDR results using an elasticsearch collapse field parameter. We key off the 'group_id' field in OCS metadata and collapse the resulting groups on the client. We pick the best result in a group by a cascading set of ˙heuristics involving eye type, geometry, image size (thumbnail vs full), and version.
    - Turn EDR grouping on and off using a new option in "View" settings in both search interfaces.
    - Reconstruction handling coming in a future update.
  - Added a custom Tile facet to select between non-tiles, tiles, and all. Defaults to non-tiles.
  - Range input facet now has a histogram that displays a rectangle around active range. Brushable histogram coming in a future update.
  - Text input facets implemented, allowed for SCLK, Activity ID, and Sequence ID facets to be brought into Facet Search UI.
  - Option to show LMST or SCLK in image search results. Change in "View" search settings.
  - Option to visually diff EDR-grouped filenames in search results. Will only appear if EDR grouping is enabled. Highlights character indices in the filename that have more than one unique value at that the given index across all members of that EDR group.
  - Infinitely scrolling search results ([Github #307](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/307))
  - Preserve "View" and "Sort" search options in localstorage. Browse and Facet search UIs have separate values. ([Github #391](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/391))
  - Improve search result speed by excluding most of the vicar label and only using the bits that are needed (solution could be improved, should be dynamic not hardcoded exclusion list).
  - Results per page bumped up to 50 results.
  - Preserve link behavior for search results, meaning users can now ctrl/cmd/shift click to open images in a new tab or window.
  - Add small image thumbnails to filename results.
  - Add "latest sol" button to Browse search UI, jumps to latest sol with imagery. Is not currently affected by other active Browse filters.
  - Browse search filter inputs now have text filters.
  - Browse search filters now use wildcard instead of regex.
- Open image in DataDrive inside Details tab in right sidebar. ([Github #386](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/386))
- More responsive navbar styling. ([Github #393](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/393))
- Add '\_cropped' to filename when preserving viewport during image export. ([Github #300](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/300))

### Bug Fixes

- Bug fix for a single DN value failure causing all DN values to be stuck in loading state ([Github #388](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/388))
- Download original file button in Details now downloads base image currently being viewed ([Github #299](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/299))
- Bug fix overlay visibility URL loading ([Github #121](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/121))
- Indicate that wildcard search can be used in image search box ([Github #342](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/342))
- Fix order of facets in Image Search ([Github #179](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/179))
- Quirk/bug/duplicate search result loading. Fixed by search UI overhaul ([Github #191](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/191))
- Fix toggling fullscreen view of the main image ([Github #75](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/75))

## 6.5.0 (July 24, 2020)

### Features

- Users can now create custom powerpoint/illustrator-lite drawing layers on top of images in {APPNAME}. Users can view multiple drawing layers at once and edit the layers they own. These drawing layers are viewable by other users and shareable via URL once added to the image.
- Added Geometry search facet
- Sort VICAR label alphabetically

### Bug Fixes

- Science Intent Facet Layout Issue ([Github #350](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/350))

### Known Issues

- Default search parameters (image size, image type (FDR, EDR, etc), and geometry) are not correctly preserved in the URL. If the user clears one of these search parameters and refreshes the page (or sends the link) the default parameters will re-appear. Workaround is to manually clear the default parameters if they re-appear. Additionally when using Sol Browse some search parameters may be influencing search but because there is no representative data product with that parameter they will be hidden. When in doubt, use the "clear filters" button in the Sol Browse search filters and rebuild your search.
- Search results can display incorrect results before eventually displaying the correct results. More noticeable with more complex queries and/or slower connections. ([Github #191](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/191))
- Image "Info" pane shows info only for the initial search result the user clicks on from the left sidebar. It does not show metadata for any of the other base images the user switches to. This also applies to the "Download Original" functionality which will only download the image the user clicks on. ([Github #299](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/299))
- Image Data Explorer (DN Cursor) gets stuck in loading states for all values when a single value fails to load. ([Github #388](https://github.jpl.nasa.gov/MIPL/react-webmarsviewer/issues/388))
