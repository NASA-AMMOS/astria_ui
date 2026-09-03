#### Finding Related Images Based on Latitude and Longitude

{APPNAME} supports searching for images that intersect particular latitude and longitude coordinates and points within an image. This is enabled by combining the XYZ overlay, PLACES, and SciLo data services (for for information on how it works, see below).

To search for images that intersect a point within a particular image, do the following:

1.  Open an image using any of the search tabs on the left.
2.  Click on the `Related` tab on the right side of the application and then click on the `Overlapping` subtab.
3.  `Ctrl + Click` on the base image to place a data cursor at a line/sample coordinate or manually enter your desired line/sample coordinate and click the search button
4.  The application will use the line/sample input to search for intersecting images and list them below, clicking on any of the listed images will open that image iin a new tab.

_NOTE_: This method requires an XYZ overlay be available. If an XYZ overlay is not available for the selected image product then the `Image Finder` panel will be empty.

To search for images that intersect a particular lat/lon location, do the following:

1.  Select the `Search` tab on the left side of the application.
2.  Scroll down in the search facets list to find the `Lon/Lat` facet, click to expand the panel.
3.  Enter the longitude and latitude of the location you want to search.
4.  Click `Search` to apply that search criteria.

**How does it work?**</br>
{APPNAME} uses the XYZ overlay to translate a line/sample point in an image to a SITE frame coordinate. It then queries PLACES to translate that SITE frame coordinate into a latitude and longitude. SciLo processes the imagery from the mission and generates footprints describing the lat/lon coverage of each image. {APPNAME} can then run a query against the SciLo data products to find images that intersect a particular lat/lon coordinate. Currently only NavCam, Hazcam, ZCAM, and SCAM are supported by SciLo though it should support other cameras in the future.
