#### Search Images by Geospatial Location

{APPNAME} supports searching for images by their geospatial location. This search capability relies on the SciLo service which generates orbital footprints for the ECAMs, ZCAM, and SCAM.

To search for images by location, do the following:

1.  Select the `Search` tab on the left side of the application.
2.  Expand on the `Map Area` filter on the left side of the application and then click on the `Open Map` button.
3.  Draw a shape around the area of interest on the orbital map using the controls in the top left of the map.
4.  Specify the area around your shape that potential images could have been acquired from. This can be accomplished using the "Image Acquisition Distance", "Field of View", and "View Angle" sliders. When used together, these sliders allow you to query for specific regions of acquisition in order to create queries like "images taken of the north side of this geological feature".
5.  Optionally specify any number of instruments found matching your query to further filter down the list of images.
6.  When you are satisfied with your query, click "Submit".
7.  Image results will be shown in the main search view and can be further filtered using any of the other available search filters.

_NOTE_: Due to technical limitations, {APPNAME} can only return up to 1000 images from the Map Area filter. A warning will be presented if your current geospatial query has exceeded this limit. You can still submit the search but it is advised that you narrow your geospatial and instrument filters since only the 1000 footprints taken closest to the center of the area you drew will be available in the main search.

**Advanced Shape Editing**</br>
The Map Area filter supports input of any GeoJSON, WKT (Well Known Text), or comma separated Lon/Lat coordinates (ex: 77,18). This can be useful when you already have shapes drawn in other software such as CAMP, ArcGIS, etc., and want to use those shapes as a filter in {APPNAME}. {APPNAME} currently only accepts Points and Polygons when using GeoJSON or WKT formats. To input a custom shape, click on the "Show Shape Editor", paste the shape in the textbox, and click "Set Shape". The shape should appear on the map. If the shape does not appear, verify that the shape is valid and that it uses double quotes if in GeoJSON format.
