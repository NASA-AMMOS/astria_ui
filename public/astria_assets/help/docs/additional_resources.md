#### Additional Resources

<b>Science Operations User Guide</b><br/>
The Science Operations User Guide provides detailed walkthroughs and illustrations of using {APPNAME} and other concepts.

<span>
    <a target="_blank" href="https://sciops.sops.m20.jpl.nasa.gov/training/marsviewer/"> https://sciops.sops.m20.jpl.nasa.gov/training/marsviewer/</a>
</span>
<br>
<br>

<b>{APPNAME} Source Code</b><br/>

<span>
    <a target="_blank" href="https://github.jpl.nasa.gov/MIPL/astria">{APPNAME} Frontend</a>
</span>
<br/>

<span>
    <a target="_blank" href="https://github.jpl.nasa.gov/MIPL/tile_service">{APPNAME} Tiling Server</a>
</span>
<br/>

<span>
    <a target="_blank" href="https://github.jpl.nasa.gov/MIPL/mis_rest_service">{APPNAME} Sampling Service</a>
</span>
<br/>
<br/>

<b>OCS Documentation</b><br/>
More information about OCS can be found here:

<span>
    <a target="_blank" href="https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake/wiki/Overview">https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake/wiki/Overview</a>
</span>
<br/>
<br/>

<b>Alternative Tools</b><br/>
Other ways to view M20 imagery:

- View images in ASTTRO. This restricts image viewing to a site and drive but should work even when the {APPNAME} Frontend is not working. However, if the {APPNAME} Backend Tiling Server is not functioning, ASTTRO will also not be able to view images.
- View and download "Browse" images in DataDrive. "Browse" images are PNG versions of image products automatically produced by the IDS pipeline. These products can be accessed by using the "Download" feature in the Image tab after you click on an image. You can also access these browse products directly in OCS through DataDrive or the command line interface. Browse products may not always exist, especially for large mosaics. When they do exist, they can be found in Browse directory one level above the image's parent directory. For example, given an image with path "A/B/C.IMG", the corresponding Browse image can be found at '../browse/B/C.IMG'.
