#### Finding Mosaics that Include an Exposure

{APPNAME} supports searching for mosaics that include the currently active exposure.

To search for mosaics that include the active exposure, do the following:

1.  Open an image using one of the search tabs on the left.
2.  Click on the `Related` tab on the right side of the application and then click on the `Used In` subtab.
3.  All mosaics the exposure is included in will be listed below.

_NOTE_: This method can also be used when viewing ECAM tiles in order to find reconstructed images that the tiles are included in.

**How does it work?**</br>
To find associated mosaics {APPNAME} searches for the existence a wildcarded version of the current base image filename in the INPUT_PRODUCT_ID label field of mosaics. For tile products the TILE_PRODUCT_ID label field is searched instead. This wildcard is used in order to map the base image to the entire exposure since any version of the base image could have been the product used for a resulting mosaic. The fields that are wildcarded are:

- Color/Filter
- Special Flag
- Product Type
- Geometry
- Thumbnail
- Camera Specific Fields
- Downsample
- Compression
- Version
