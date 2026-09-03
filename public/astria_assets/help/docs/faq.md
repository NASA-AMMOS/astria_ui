#### Frequently Asked Questions

<details>
    <summary>What is {APPNAME}?</summary>
    <p>
        {APPNAME} is a tool for quickly browsing, viewing, and sharing image products.
    </p>
</details>
<details>
    <summary>What is the difference between {APPNAME} and ASTTRO?</summary>
    <p>
        {APPNAME} is optimized for fast, mission-wide image browsing and search, complex RDR overlay control, custom drawings, and more. ASTTRO, or Advanced Science Targeting Tool for Robotic Operations, is primarily optimized for science targeting and is generally centered around a single site and drive.
    </p>
</details>
<details>
    <summary>Why isn't X showing up for me in {APPNAME}?</summary>
        <ul>
            <li>The product may not have been processed by the image processing pipeline yet.</li>
            <li>Search for the file on DataDrive to ensure it exists there. If it doesn’t, then the file may not have been indexed into OCS yet so try again later.</li>
            <li>Ensure you have the package selected in {APPNAME} that the product lives in.</li>
            <li>Check the file extension. {APPNAME} only supports .IMG for EDR/RDR and Mosaic types so if you’re looking for a .VIC, try the corresponding .IMG.</li>
            <li>If the product you're looking for is an RDR (XYZ, Range, etc) you’ll have to select a corresponding base image first (FDR, EDR, TDR, etc) and then activate the desired RDR from the RDRs subtab in the Overlays tab.</li>
            <li>You can try passing the S3 URL of the product into the {APPNAME} EDR URL parameter. For example, if you’re looking for product X, you could use the following query in your URL: `?EDR=X`. {APPNAME} will attempt to display the product as the primary image however this feature is not guaranteed to work as {APPNAME} is primarily designed to load base images as the primary image.
            </li>
        </ul>
</details>
<details>
    <summary>When can I expect to see images showing up in {APPNAME} after a pass?</summary>
    <p>
      EDRs should be available in less than five minutes after being received. RDRs may take longer depending on their type and order in the processing pipeline.
    </p>
</details>
<details>
    <summary>How can I see only one type of data? Say only Quicklooks?</summary>
    <p>
        To see only Quicklooks, select “Quicklook” in the Object Type facet/filter in one of the search tabs.
    </p>
</details>
<details>
    <summary>How can I see the most recent data?</summary>
    <p>
        Sort using the "Last Updated" option inside <code>View</code> options in any of the search tabs. You can also use the <code>Last Updated Cut-off</code> and <code>ERT Cut-off</code> facets in the <code>Search</code> tab to restrict your search to more recently updated/received products.
    </p>
</details>
<details>
    <summary>How can I see data for a particular pass?</summary>
    <p>
        Currently {APPNAME} does not have a way to search by specific time ranges. For now you can sort by ERT, sort by ascending, and use the ERT cut-off facet to limit your search to the beginning ERT of the pass. You can also filter by Sol and other fields to help narrow down the results.
    </p>
</details>
<details>
    <summary>How does {APPNAME} decide which product best represents an exposure in the search results?</summary>
    <p>
        {APPNAME} groups products from a single "exposure" together in search results and displays the "best" product out of the whole set. The fields that are considered for grouping are: image size (full vs thumbnail), eye (left, right, mono, etc), special processing flag, stereo counter, reconstruction type, reconstruction counter, downsample, compression, projection, geometry, product type, and version. After clicking on a product in search, all of the other products from that exposure can be viewed by using the selectors available in the <code>Image</code> tab in the right sidebar. This exposure grouping is responsive to your search, however, so if you select only Mastcam-Right and not Mastcam-Left you'll see only right eye products. When you uncheck Mastcam-Right or check Mastcam-Left (same effect), the left eye products, when they exist, will take precedence over the right eye products. You can opt out of this “best image” grouping behavior by toggling off “EDR Grouping” in the <code>View</code> options of any of the search tabs.
    </p>
</details>
<details>
    <summary>What file types does {APPNAME} support?</summary>
    <p>
        {APPNAME} can natively view: IMG, PNG, JPEG, TIFF, GIFs, and PDFs. This covers single frame images, mosaics, user uploads, and quicklooks. {APPNAME} also allows users to search for and view {APPNAME} Drawings. For other products, try looking for them in DataDrive and opening them with other programs if needed.
    </p>
</details>
<details>
    <summary>What is the difference between the Sol, Search, and Mosaic tabs?</summary>
    <p>
        Both the Sol tab and the Search tab are drill-down search interfaces whereas the Mosaic tab is a searchable timeline and displays all the mosaics in a particular category for the entire mission.
        <ul>
            <li>The Sol tab can be useful when you're only interested in a single sol and don't need many search filters as it is a simpler interface.</li>
            <li>The Search tab can be useful when you're attempting to perform a more open ended or advanced search across the entire mission.</li>
            <li>The Mosaic tab can be useful when you are interested in finding the most commonly relevant mosaics to help provide context within the mission.</li>
        </ul>
    </p>
</details>
<details>
    <summary>How do you compute distance measurements?</summary>
    <p>
        Measurements in {APPNAME} are computed by calculating the Euclidean distance between two points in XYZ space. These XYZ values are provided by the {APPNAME} Image Sampling service.
    </p>
</details>
<details>
    <summary>Why are measurements sometimes "unknown"</summary>
    <p>
        Measurements will display "unknown" when one or both of the measurement endpoints have no XYZ data available.
    </p>
</details>
<details>
    <summary>How do you compute scalebar values for single frame images and mosaics?</summary>
    <p>
        For most images, scale is derived from the iFOV of the pixel the scalebar is centered on and the range data at that pixel. This computation is fairly accurate. For mosaics, scale is also derived from the surface model stored in the VICAR label when range data isn’t available. Because the surface model does not include any actual information about surface topography, this value may be very inaccurate. Generally speaking, the scalebar accuracy will be best when placed on close, flat ground. Near the horizon and up on rocks and in valleys the scalebar accuracy will be poor. The scalebar will note when the surface model is being used.
    </p>
</details>
<details>
    <summary>I clicked on an image but nothing is loading, what do I do? Are there other ways to view an image?</summary>
     <p>
        <ul>
            <li>Try waiting a minute and if the image does not load, refresh the page.</li>
            <li>If this does not work and if you see ‘?’s for the image previews, the {APPNAME} Image Tiling service which provides images may be under heavy load and should automatically return to service within 15-30 minutes.</li>
            <li>Alternative Method: From {APPNAME} you can download the original IMG or the full resolution “browse” image as a PNG from the “Image” tab in the right sidebar.</li>
            <li>Alternative Method: Search for the image in DataDrive and download the original or PNG browse version for local viewing.</li>
            <li>Alternative Method: Download the IMG or PNG browse image directly from S3 and open with the appropriate tool.</li>
        </ul>
    </p>
</details>
<details>
    <summary>How are range facet values populated by default in the Search tab?</summary>
    <p>
        Range facet values like Sol, Site, and Drive are populated using the maximum and minimum values found for those parameters in the current OCS package.
    </p>
</details>
<details>
    <summary>What gets saved in the URL?</summary>
     <p>
        <ul>
            <li>The search result you clicked on</li>
            <li>Active Overlays (RDRs, annotations, and image features)</li>
            <li>Overlay order and opacity</li>
            <li>Global overlay visibility</li>
            <li>Image Data Explorer cursor</li>
            <li>Current image zoom</li>
            <li>Current image center</li>
            <li>Measurements</li>
            <li>OCS Package</li>
            <li>Image stretch</li>
            <li>Active search tab</li>
            <li>Active Image details tab</li>
        </ul>
    </p>
</details>
<details>
    <summary>What gets saved in my browser?</summary>
     <p>
        <ul>
            <li>Search sidebar and image details sidebar sizes and collapsed states</li>
            <li>Image details metadata filter (default vs all)</li>
            <li>Image viewing history</li>
            <li>Starred metadata fields</li>
            <li>View and sort options in all result lists</li>
            <li>Image viewer settings (navigator visibility, image smoothing toggle, az/el guides visibility, scalebar visibility)</li>
            <li>Geospatial map configuration preferences</li>
        </ul>
    </p>
</details>
<details>
    <summary>Where do the Map View image and vector layers come from?</summary>
     <p>
        The orbital imagery, footprints, and rover waypoints and traverse layers come from CAMP.
    </p>
</details>
