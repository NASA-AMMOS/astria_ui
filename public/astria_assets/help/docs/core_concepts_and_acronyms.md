#### Core Concepts & Acronyms

<b>How are raw data products processed into the images seen in {APPNAME}?</b><br/>
Raw data products are processed by the IDS (Image Data System) pipeline to produce a variety of base images and derived products. These images are then ingested into OCS (Operational Cloud Store) so they can be seen in DataDrive, {APPNAME}, and other tools. {APPNAME} then creates image pyramids for each image to allow images of any size to be performantly viewed in the browser. For more information on how these images are processed please refer to the Mars 2020 Camera SIS. [GDS Documentation Page](https://sciops.sops.m20.jpl.nasa.gov/private/gds-documentation/).

<b>What types of products can I view in {APPNAME}?</b><br/>
In {APPNAME} you can view Single Frame Images and Mosaics, {APPNAME} User Uploads (images and PDFs), Quicklooks, and {APPNAME} Drawings.

<b>What is an EDR?</b><br/>
EDRs (Experiment Data Record) are defined as products that reconstruct as closely as possible the data acquired by the camera, given transmission constraints. So they include the "Raw" products derived straight from telemetry, as well as the "Partially Processed" products relating to decompanding and de-Bayering, which simply reconstruct the data acquired by the sensor without any form of calibration or processing.

<b>What is an FDR?</b><br/>
FDRs are the "Fundamental Data Record"; this is a consistently-formatted product at the end of the EDR chain that is used as the basis for all downstream RDR processing (it also includes tile reassembly for the Engineering Cameras, as well as some label updates on certain instruments).

<b>What is a TDR?</b><br/>
The TDR represents the “base image” from which all other tile RDRs derive. The TDR is the same concept as the FDR, but at the tile level for the Engineering Cameras and provides a consistent starting point for all tile RDR processing. There are several nuances to tiling, as described in Section 5.6.1.1 of the Mars 2020 Camera SIS, that need to be removed to enable correct reconstruction of the “full” image that makes the reconstructed FDR.

<b>What is a Base Image?</b><br/>
A "Base Image" or "Underlay" in {APPNAME} refers EDR products (the EDR product itself, RAS, RAD, FDR, TDR, etc). You can overlay other compatible products such as RDRs and {APPNAME} Drawings on top of a single "Base Image".

<b>What is the OCS?</b><br/>
The OCS is the Operational Cloud Store. This system is roughly the cloud-equivalent of the ODS filesystem found on other missions such as Mars Science Laboratory. Formally, the OCS is a system that indexes and provides access to GDS artifacts stored in AWS S3 or that are otherwise URL-addressable. For more information please visit the [OCS wiki page](https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake/wiki/Overview) or contact GDSO.

<b>What is an OCS Object Type</b><br/>
Every object in OCS has a specific "Object Type" which defines the metadata schema for that object. {APPNAME} uses this field to differentiate between Single Frame Images, Mosaics, {APPNAME} User Uploads, {APPNAME} Drawings, and Quicklooks. By default {APPNAME} displays only Single Frame Images (labeled as EDR) and Mosaics, so if you are looking for a different object type you will need to include it in the "Object Type" facet in {APPNAME} search.
