#### Image Export

The Image Export tools in {APPNAME} allow you generate low, medium, and high resolution images of your current view including any RDRs, drawings, measurements, and targets you may have active.

To get started, first finalize your view by adjusting your zoom/center and turning on or off any items (RDRs, drawings, etc.) you want to include or exclude. Then click on the **Image Export** button in the header next to **Saved Searches** and **Image Upload**

#### Image Export Options

**Resolution**</br>
The resolution selector allows you to select the pixel width/height of your export. Each of the four resolution options will limit the length of the longest edge of the exported image as follows:

 * _Low_: 1080 pixels
 * _Medium_: 2160 pixels
 * _High_: 4320 pixels
 * _Actual_: The pixel length of the longest side of the base image

The length shorter side of the image is determined by the ratio of the width to height of the base image. As such, the exact values of these resolutions will change depending on the dimensions of the current base image.

Additionally, these resolutions will change if you select to **Preserve Image Zoom and Position** (see below). In that case, the aspect ratio of the current view, and not the base image, will be referenced in generating the export resolutions and the _Actual_ resolution will reflect the pixel width/height of the current view rather than the base image.

**Preserve Image Zoom and Position**: If selected, then only the section of the image that is within your viewer bounds will be exported. This allows you to crop out unwanted areas of the image and focus only a particular piece of the image. Note that selecting this will affect your resolution options (see above).

**Include Drawings**: If selected, then all drawings that are currently visible (even if only partially) in the viewer will be included in the exported image.

**Include Measurements**: If selected, then all measurements that are currently visible (even if only partially) in the viewer will be included in the exported image.

**Include Targets**: If selected, then all targets that are currently visible (even if only partially) in the viewer will be included in the exported image.

**Include Azimuth/Elevation Rulers**: If selected, then the Azimuth/Elevation rulers on the top and left of the viewer will be included in the exported image. Note: this option will be disabled for images that do not support Azimuth/Elevation rulers.

#### Image Export Limitations

There are certain browser constraints that limit the maximum resolution of an image export. If the selected export resolution has a shortest edge length is larger than 32,767 pixels or the export resolution has an area greater than 268,435,456 pixels, then the browser may fail to generate the composite image and will export simply a blank image.

#### Image Export Versus Image Download

The goal of **Image Export** is to generate a composite image of your current view in {APPNAME}. **Image Download**, on the other hand, enables you to download the original IMG or browse PNG version of a given image product.

