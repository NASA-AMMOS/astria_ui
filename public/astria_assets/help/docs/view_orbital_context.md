#### View orbital image context

Select the `Map` tab on the right side panel. Here you will see the rover location and orientation at the time of image acquisition visualized on top of an orbital basemap of the Jezero crater region. Additionally if the image has an associated orbital footprint created by the SciLo service the footprint will appear on the map. The rover traverse and RMC waypoints will also appear on the map for additional context.

**Visualizing the image data cursor on the map**<br>
{APPNAME} will attempt to visualize the image data cursor on the map if there is stereo data present at the line/sample of the cursor. Note that this position is an estimate and accuracy is variable and is also dependent on the quality of the stereo information.

**Visualizing the map data cursor on the image**<br>
Control click on the map to place a data cursor on the map. {APPNAME} will attempt to estimate the position of this lon/lat within the current image when possible although accuracy is variable due to the backprojection methods used which do not account for terrain.

**Data Sources**<br>
All orbital imagery and vector layers are served from CAMP with the exception of image footprints which are provided by the SciLo service.
