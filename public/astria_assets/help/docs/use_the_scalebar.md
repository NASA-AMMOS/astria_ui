#### Use the scalebar

The {APPNAME} scalebar displays dynamic scale information for the following image types:
 * Single frame images that have an RNG product available
 * Cylindrical mosaics (it will either use the associated XYZ/RNG product or fall back to a rough surface model projection)
 * Single frame WATSON images with a FOCUS_POSITION_COUNT indicating a working distance between 1.8cm and 220cm
 * Single frame ACI images with a FOCUS_POSITION_COUNT indicating a working distance between 40mm and 56mm
 * Single frame RMI images with a INSTRUMENT_FOCUS_DISTANCE less or equal to 31m

 If the scale bar tool is available for the image you are looking at, the scalebar will appear in the lower-left corner of the image viewer. The scalebar can also be hidden from the settings menu found in the bottom toolbar.

**Move the scalebar**<br>
Click and drag the scalebar to move it to another location on the screen. The scalebar will automatically update with a new scale value and size based on that pixel.

**Pinning the scalebar**<br>
The scalebar can be pinned to a pixel in the image or can be fixed to a position in the screen. By default the scalebar is fixed to a position in the screen. To pin the scalebar to a pixel, hover over the scalebar and click on the `Pin to Image` button.

**Scalebar availability**<br>
If the scale bar does not appear in the lower-left corner of the image, the product you are viewing does not have a corresponding range product and the scale bar will not work. If the scale bar does appear but says `unknown` it means there is no RNG data where you have placed the scale bar. To see where the RNG data is, turn on the RNG overlay in the overlays panel. For images with sparse RNG coverage you may want to turn on the RNG overlay to get a better sense of where the scalebar will be available within the image.

**Scalebar accuracy**<br>
For most single frame images, scale is derived from the iFOV of the pixel the scalebar is centered on and the range data at that pixel. This computation is fairly accurate.

For mosaics, scale is also derived from the surface model stored in the VICAR label when range data isn’t available. Because the surface model does not include any actual information about surface topography, this value may be very inaccurate. Generally speaking, the scalebar accuracy will be best when placed on close, flat ground. Near the horizon and up on rocks and in valleys the scalebar accuracy will be poor. The scalebar will note when the surface model is being used.

For single frame WATSON images, the scale is derived from the FOCUS_POSITION_COUNT and as a result the accuracy of the scale estimation will decrease in areas where pixels are less in-focus. For ACI images, the scale is fixed at 10.1µm/pixel because details for pixel scale relative to range on ACI have not been characterized.

For single frame RMI images, the scale is derived from the INSTRUMENT_FOCUS_DISTANCE and INSTRUMENT_FOCUS_DISTANCE__UNIT and as a result the accuracy of the scale estimation will decrease in areas where pixels are less in-focus. Generally speaking the closer the target the more accurate the scale estimation will be.
