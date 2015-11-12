# Provisualizer

## Files

To install PROVisualizer, either download the ZIP file from  https://github.com/Conal-Tuohy/Provisualizer/archive/master.zip, unpack it, and upload it to the desired location on the webserver, or use `git` to clone the code to the desired location on the hosting web server e.g. 

```bash
git clone https://github.com/Conal-Tuohy/Provisualizer.git
```
The `embedding` folder merely contains an example of how to embed the visualizer in another web page, even on another website. 

## Server configuration for CORS

In order to enable embedding of the visualization in other websites, distinct from the site in which it is hosted, it's necessary to make a small configuration change to the web server which hosts the data.

When the visualization is embedded on another webserver, it will still request its data from the hosting webserver, but browser security will normally block the visualization from making such requests, unless the host server explicitly grants permission for its data to used by pages hosted on other webservers. This security issue is called "Cross Origin Resource Sharing" or CORS. See http://enable-cors.org/ for details on CORS and how to enable it on different webservers. For example the following Apache configuration will allow any website to make requests to data within the folder "/provisualizer/":
```
# Enable Cross Origin Resource Sharing for PROVisualizer
#
<Location /provisualizer/>
  Header set Access-Control-Allow-Origin "*"
</Location>
```

## Use
To view the visualization, navigate a browser to the location of the `index.html` file. Typically any file called `index.html` is treated as the default file for a folder, so navigating to the provisualizer folder should cause the web server to serve up the `index.html` page.

To share a link, click the sharing icon in the lower left of the visualization, and choose a sharing tool.

To zoom, double click on the white space in the visualization, use a mouse scroll wheel, or use pinching gestures on a touch screen device.

To drag a node to a fixed location (i.e. manual layout of the graph), click on the coloured circle.

To follow the link from a node to the PROV catalogue, click on the textual label of the node.

Hover your cursor over a node's circle or textual label to highlight the links from the node to its neighbours.

To embed the visualization in another page, using the sharing tool (button in lower left corner of the visualization) and select the "Embed" button. In the embedding dialog box, specify a width and height (using standard CSS syntax such as `800px` or `90%` etc.), and copy and paste the resulting code into the host web page.

If the user's browser permits full screen mode, a full-screen icon will appear in the lower right corner of the visualization. Clicking the icon will cause the visualization to go full screen, and clicking it again will cause it to return to normal.

When a search is performed, the URI fragment (or "hash") is updated to reflect the search parameters. If this URI is bookmarked or shared, the URI when resolved will cause the search to run again. A default search can be embedded in the HTML of the provisualizer page. The "Embed" share tool automatically includes the current search parameters in the embed code which it generates. If the Provisualizer is run without a URI fragment, it will use the search specified in the HTML. If no default is available, it will fall back to a hard-wired search for "Gold, 1840".
