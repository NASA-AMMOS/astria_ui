#### Change how search results look

{APPNAME} provides several ways to customize how the search results appear in a variety of result lists. All of these options are preserved locally in your browser and apply independently to each result list.

<b>View options</b><br>
In the `View` menu found above the search results, you can choose between preview image or filename appearance, the size of the previews, and the time label that appears on the previews.

Additionally, you can control `EDR Grouping` mode and `Filename Diffing`. `EDR Grouping` mode is on by default and groups images from the same exposure into a single search result represented by the “best image”. This “best image” is determined by a ranked set of preferences for several fields like camera eye, geometry, image size, version, etc. This grouping of search results is also affected by the search filters you use. For example, this image grouping would normally prefer a left eye product over a right eye product but if you select only right eye products from the “Instrument” filter, only right eye products will appear in the search results. Disabling `EDR Grouping` mode will result in all products for an exposure appearing in search results. This is generally only needed in rare cases and will greatly increase the number of search results.

The `Filename Diffing` option highlights the characters of a grouped search result filename that have at least one difference among all members of the exposure. For example, if there is a left eye Navcam and a right eye Navcam inside of an exposure group, the second character will be highlighted. Note that this mode only applies when using the `filename` option of the `Result Display` selector.

<b>Sort options</b><br>
In the `Sort` menu found above the search results, you can choose the sort direction and sort field of the search results.
