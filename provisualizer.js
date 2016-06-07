var script = d3.select('#provisualizer-script').attr('src');
var baseUrl = script.substring(0, script.lastIndexOf('provisualizer.js'));
if (baseUrl == "") {
	baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/";
}

// add CSS stylesheets
var head = d3.select('head');
head.append('link')
	.attr('type', 'text/css')
	.attr('rel', 'stylesheet')
	.attr('href', baseUrl + 'provisualizer.css');
head.append("link")
	.attr('type', 'text/css')
	.attr('rel', 'stylesheet');
		
var maxLabelLength = 80;
var provisualizer = d3.select("#provisualizer").append("div")
	.attr("style", "position: relative; width: 100%; height: 100%; margin: 0; padding: 0; background-color: white;");
var width = provisualizer.node().offsetWidth; 
var height = provisualizer.node().offsetHeight; 
var labelFadeTime = 3000;
var labelFadeDelay = 10000;
var toolBar = null;
var hideLabelsButton;

//var helpJQueryDialog = $(help[0]);
//helpJQueryDialog.css("overflow-y:auto; overflow-x:hidden; z-index:200");
/*
$.get(
	"help.html",
	function(data) {
		helpJQueryDialog.html(data);
	}
);
*/
// TODO start off hidden and open by clicking a toolbar button
/*
helpJQueryDialog.dialog(
	{
		resizable: true,
		autoOpen: false,
		title: "Help",
      	closeText: "hide",
      	position: {
      		my: "bottom",
      		at: "top center"
      	},
      	//width: (width / 3 > 350) ? width / 3 : 350,
      	//height: height / 2,
      	//minWidth: 300,
      	//minHeight: 200,
      	buttons: {
      		Hide: function() {
      			$( this ).dialog( "close" );
      		}
      	}
    }
);
helpJQueryDialog.dialog("open");
      	*/
	
      		
// labels don't need a box, just a floating label by itself
//var popup = provisualizer.append("div")
//	.attr("class", "popup");

var force = d3.layout.force()
	.friction(0.95)
	.gravity(0.08)
	.size([width, height])
	.charge(
		function(node) {
			return -400 * node.weight;
		}
	)
	.chargeDistance(800)
	.linkDistance(
		function(link, index) {
			//return 80;
			//return 20 + Math.sqrt(link.source.weight + link.target.weight);
			return 80 + (Math.sqrt(link.source.weight) + Math.sqrt(link.target.weight)) * 20;
		}
	)
	.on("tick", tick);

var drag = force.drag()
	.on("dragstart", dragstart);

addSearchForm();
addSharingTools();
var fullScreenButton;
addFullscreenButton();
addEmbeddingGuide();
addZeroResultsDialog();
addHelp();

//startLabelFadeTimer();
var zoomBehavior = d3.behavior.zoom();
var svgContainerDiv = provisualizer.append("div");
svgContainerDiv.attr("style", "height: 100%; box-sizing: border-box; padding-top: 150px;");
var outerSvg = svgContainerDiv.append("svg")
	.attr("width", "100%")
	.attr("height", "100%") 
    		.call(zoomBehavior.on("zoom", zoom));

var svg = outerSvg
		.append("g");


var linkLines = svg.selectAll(".link");
var nodeCircles = svg.selectAll("circle.node");	
var nodeLabels = svg.selectAll("text.node");

// array of rows read from CSV (unfiltered)
var edges = [];

// map from node names to node attributes
var nodeAttributesByNodeName = {};

// list of function names
var functionNames = [];
var uniqueFunctionNames = {};
		
d3.csv(
	baseUrl + "data/nodes.csv", 
	function(error, nodeAttributes) {
		nodeAttributes.forEach(
			function(nodeAttributeSet) {
				if (nodeAttributeSet.NAME.substr(0, 2) == "VF") {
					// then the node represents a function, not an agency or series
					functionNames.push(nodeAttributeSet.NAME);
				}
			}
		);
		functionNames.sort(functionNameComparator); // so that the list box of functions is sorted
		functionNames.forEach(
			function(functionName) {
				uniqueFunctionNames[functionName] = functionName;
			}
		);
		populateFunctionDropDownList();
		nodeAttributes.forEach(
			function(nodeAttributeSet) {
				nodeAttributesByNodeName[nodeAttributeSet.NAME] = nodeAttributeSet; 
			}
		);
		// Now these node attributes can be read below
		d3.csv(
			baseUrl + "data/edges.csv", 
			function(error, edgesCSV) {
				edges = edgesCSV;
				createFilteredGraphFromLinks();
			}
		)
	}
);
function functionNameComparator(a, b) {
	if (functionNameExcludingCode(a) < functionNameExcludingCode(b)) {
		return -1;
	} else {
		return 1;
	}
}
function functionNameExcludingCode(functionNameWithCode) {
	var n = functionNameWithCode.substr(3).indexOf(" ") + 4;
	return functionNameWithCode.substr(n);
}

function tick() {
	linkLines
		.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
	nodeLabels
		.attr("x", function(d) { 
			if (d.x > width / 2)
				return d.x + 15;
			else
				return d.x - 15;
		})
		.attr("y", function(d) { return d.y; });
	nodeLabels.classed("right-aligned", function(d) {
			return d.x * 2 < width;
	});
	nodeCircles
		.attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; });
	zoomToFit();
}

function dblclick(d) {
	// don't propagate the event, otherwise the zoom/pan behaviour will handle it and
	// effectively nullify the dragging of this individual node
	d3.event.stopPropagation();
	// mark the node as not being fixed in place - it can float freely
	d3.select(this).classed("fixed", d.fixed = false);
}

function dragstart(d) {  
	// don't propagate the event, otherwise the zoom/pan behaviour will handle it and
	// effectively nullify the dragging of this individual node
	d3.event.sourceEvent.stopPropagation();
	// mark the node as being fixed in place
	d3.select(this).classed("fixed", d.fixed = true);
}

function jump(d) {
	window.open(d.URL, d.name);
}

function includeNode(nodeName, nodes, nodeIndicesByNodeName) {
	if (! (nodeName in nodeIndicesByNodeName)) {
		// no node with that name yet
		var newNodeIndex = nodes.length;
		var displayNode =  {
			name: nodeName,
			type: nodeName.substr(0, nodeName.indexOf(" ")) // "VF", "VA", or "VPRS"
		};
		var nodeAttributes = nodeAttributesByNodeName[nodeName];
		for(var p in nodeAttributes) displayNode[p]=nodeAttributes[p];
		nodes[newNodeIndex] = displayNode;
		nodeIndicesByNodeName[nodeName] = newNodeIndex;
	}
}

function createFilteredGraphFromLinks() {
	// Extract the distinct nodes from the node relationship table.
	
	// arrays containing the node objects, and the link objects, for D3 force layout
	var nodes = [];
	var links = [];
	// map from node names to node array indices
	var nodeIndicesByNodeName = {};
	
	edges.forEach(
		function(edge) {
			var sourcePeriod = nodeAttributesByNodeName[edge.SOURCE].PERIOD;
			var targetPeriod = nodeAttributesByNodeName[edge.TARGET].PERIOD;
			if (
				// TODO check the criteria for inclusion. Currently both nodes must have matching dates,
				// and one node must have matching text.
				matchesDateFilter(sourcePeriod) &&
				matchesDateFilter(targetPeriod) &&
				(matchesTextFilter(edge.SOURCE) || matchesTextFilter(edge.TARGET))
			) {
				includeNode(edge.SOURCE, nodes, nodeIndicesByNodeName);
				includeNode(edge.TARGET, nodes, nodeIndicesByNodeName);
				links.push(
					{
						source: nodes[nodeIndicesByNodeName[edge.SOURCE]],
						target: nodes[nodeIndicesByNodeName[edge.TARGET]]
					}
				)
			}
		}
	);
	
	/*
	// initialize node locations along a diagonal

	if (nodes.length > 0) {
		var xIncrement = width / nodes.length;
		var yIncrement = height / nodes.length;
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].x = i * xIncrement;
			nodes[i].y = i * yIncrement;
		}
	}
	*/
	/*
	if (nodes.length > 0) {
		theta = 2 * 3.14159 / nodes.length;
		xCentre = width * 0.5;
		yCentre = height * 0.5;
		r = Math.sqrt((width * width) + (height * height))/ nodes.length;
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].x = xCentre + Math.random();
			nodes[i].y = yCentre + Math.random();
		}
	}	
	*/
	if (nodes.length == 0) {
		showZeroResultsDialog();
	} else {
		hideZeroResultsDialog();
		theta = 2 * 3.14159 * Math.sqrt(nodes.length);
		xCentre = 0;//width * 0.5;
		yCentre = 0;//height * 0.5;
		r = 3 * Math.sqrt((width * width) + (height * height)) / (nodes.length * nodes.length);
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].x = xCentre + Math.cos(theta * i) * r *  (nodes.length - i) * (nodes.length - i);
			nodes[i].y = yCentre + Math.sin(theta* i) *  r *  (nodes.length - i) * (nodes.length - i);
		}
	}	
	// create force layout
	force
		.nodes(nodes)
		.links(links)
		.start();
		
	// (re-)populate force layout


	linkLines = linkLines.data(
		links,
		function(d) {
			return d.source.name + "->" + d.target.name;
		}
	);
	linkLines.exit().remove();
	linkLines
		.enter().append("line")
		.attr("class", "link");
	

	nodeCircles = nodeCircles.data(
		nodes,
		function(d) { 
			return d.name + d.type; 
		}
	);
	
	nodeCircles.exit().remove();
	
	nodeCircles.enter()
		.append("circle")
			.attr(
				"class", 
				function(n) { 
					return n.type + " node";
				}
			)
			/*
			.attr(
				"title",
				function(n) {
					return n.name;
				}
			)
			*/
			.attr(
				"r", 
				function(n) {
					//return 10;
					return Math.sqrt(n.weight) * 10;
				}
			)
			// opacity depends on the node degree - node with high degree would be almost solid, degree 1 would be almost transparent
			.style(
				"fill-opacity", 
				function(n) {
					return 0.9 - (.7/ n.weight);
				}
			)
			.on("dblclick", dblclick)
			.on("mouseover", mouseover)
			.on("mouseout", mouseout)
			.call(drag);		
			
	nodeLabels = nodeLabels.data(
		nodes,
		function(d) { 
			return d.name + d.type; 
		}
	);
	
	nodeLabels.exit().remove();
	nodeLabels.enter()
		.append("text")
			.attr(
				"class", 
				function(n) { 
					return n.type + " node label";
				}
			)
			//.attr("x", function(d) { return d.cx; })
			//.attr("y", function(d) { return d.cy; })
			.text( 
				function (n) { 
					if (n.name.length > maxLabelLength) 
						return n.name.substring(0, maxLabelLength) + "..."
					else
						return n.name; 
				}
			)
			.attr(
				"dx",
				function(n) {
					//return 10;
					return Math.sqrt(n.weight) * 5;
				}
			)
			.attr(
				"dy",
				function(n) {
					//return 10;
					return - Math.sqrt(n.weight) * 5;
				}
			)
			/*
			.attr(
				"title",
				function(n) {
					return n.name;
				}
			)
			*/
			.on("mouseover", mouseover)
			.on("mouseout", mouseout)
			.on("click", jump);	
			
	var ticks = 10;
	var startTime = new Date().getTime();
	for (var i = 0; i < ticks; ++i) force.tick();
	var endTime = new Date().getTime();
	console.log("Running force layout for", ticks, "ticks, in", endTime - startTime, "ms");
		
}


// experiment to add agency and function labels as nodes in their own right, linked to the circles representing agencies and functions
function addNodeLabel(node, nodes, links) {
	return; // disabled
	// attach a new label node to the specified node
	var nodeIndex = nodes.length;
	var labelNode = {
		name: node.name,
		type: "label"
	};
	nodes[nodeIndex] = labelNode;
	links.push(
		{
			source: nodes[nodeIndex - 1],
			target: nodes[nodeIndex]
		}
	)
}

function addFullscreenButton() {
	if (fullscreenEnabled()) {
		fullScreenButton = provisualizer.append("img")
			.attr("id", "full-screen-button")
			.attr("src", baseUrl + "fullscreen.png")
			.attr("alt", "Toggle full screen")
			.attr("title", "Toggle full screen")
			.on("click", toggleFullscreen);
	}
	d3.select(document);
		
}

function toggleFullscreen() {
	if (fullscreenElement() == null) {
		goFullscreen(provisualizer.node());
	} else {
		exitFullscreen();
	}
}
function fullscreenEnabled() {
	return  document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
}
function fullscreenElement() {
	if (document.fullscreenElement) {
		return document.fullscreenElement;
	} else if (document.mozFullScreenElement) {
		return document.mozFullScreenElement;
	} else if (document.webkitFullscreenElement) {
		return document.webkitFullscreenElement;
	} else if (document.msFullscreenElement) {
		return document.msFullscreenElement;
	} else {
		return null;
	}
}
function goFullscreen(element) {
	if(element.requestFullscreen) {
		element.requestFullscreen();
	} else if(element.mozRequestFullScreen) {
		element.mozRequestFullScreen();
	} else if(element.webkitRequestFullscreen) {
		element.webkitRequestFullscreen();
	} else if(element.msRequestFullscreen) {
		element.msRequestFullscreen();
	}
}
function exitFullscreen() {
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.msExitFullscreen) {
		document.msExitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	}
}

function addZeroResultsDialog() {
	var zeroResultsDialog = provisualizer.append("div")
		.attr("id", "zero-results-dialog")
		.classed("hidden", "true");
	zeroResultsDialog.append("img")
		.attr("class", "close-button")
		.attr("src", baseUrl + "close.png")
		.attr("alt", "Close")
		.attr("title", "Close")
		.on("click", hideZeroResultsDialog);
	zeroResultsDialog.append("h1")
		.text("No matches found");
	zeroResultsDialog.append("p")
		.text("Your search turned up no results, please try again with a broader search.");
}

function showZeroResultsDialog() {
	d3.select("#zero-results-dialog").classed("hidden", false);
}

function hideZeroResultsDialog() {
	d3.select("#zero-results-dialog").classed("hidden", true);
}

function addSharingTools() {
		var shareButton = provisualizer.append("img")
			.attr("id", "share-button")
			.attr("src", baseUrl + "share.png")
			.attr("alt", "Share")
			.attr("title", "Share")
			.on("click", toggleSharingToolbox);
			
		var sharingToolbox = provisualizer.append("div")
			.attr("id", "sharing-toolbox")
			.classed("hidden", true);
		// <a href="https://www.facebook.com/sharer/sharer.php?u={url}">Share on Facebook</a>
		sharingToolbox.append("img")
			.attr("class", "close-button")
			.attr("src", baseUrl + "close.png")
			.attr("alt", "Close")
			.attr("title", "Close")
			.on("click", hideSharingToolbox);
			
		sharingToolbox.append("h1")
			.text("Share your search");
		var shareList = sharingToolbox.append("ul")
			.attr("class", "ss-share");
			
		addTool(shareList, "ico-facebook", "Facebook", shareOnFacebook);
		addTool(shareList, "ico-twitter", "Twitter", shareOnTwitter);
		addTool(shareList, "ico-email", "Email", shareByEmail);
		addTool(shareList, "ico-embed","Embed", shareByEmbedding);
}

function addTool(shareList, cssClass, name, eventHandler) {
		var item = shareList.append("li")
			.attr("class", "ss-share-item");
		item.append("a")
			.attr("class", "ss-share-link " + cssClass)
			.on("click", eventHandler)
			.text(name);
}

function shareOnFacebook() {
	var search = d3.select('#agency-or-function-name-filter').property("value");
	var URL = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location);
	window.open(URL, "Share");
	hideSharingToolbox();
}
function shareOnTwitter() {
	var search = d3.select('#agency-or-function-name-filter').property("value");
	var tweet = "Visualized '" + search + "' at @PRO_Vic: " + window.location;
	var URL = "https://twitter.com/home?status=" + encodeURIComponent(tweet);
	console.log(URL);
	window.open(URL, "Share");
	hideSharingToolbox();
}
function shareByEmail() {
	var search = d3.select('#agency-or-function-name-filter').property("value");
	var subject = "Visualization of '" + search + "'";
	var message = "Check out this visualization of a search for '" + search + "' at PROV: <" + window.location + ">";
	var URL = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(message);
	console.log(URL);
	window.open(URL);
	hideSharingToolbox();
}
function shareByEmbedding() {
	var embeddingGuide = d3.select("#embedding-guide").classed("hidden", false);
	updateEmbeddingCode();
	hideSharingToolbox();
}
function updateEmbeddingCode() {
	/*
	e.g.
	<div id="provisualizer" style="width: 700px; height:900px; border: 1px solid black;">
		<div id="embed-search">fish</div>
		<script src="http://d3js.org/d3.v3.min.js"></script>
		<script id="provisualizer-script" src="http://conaltuohy.com/clients/prov/provisualizer/provisualizer.js"></script>
	</div>
	*/	
	var embeddingCode = "<div id='provisualizer' style='width: "
		+ d3.select("#embedding-width").property("value")
		+ "; height: "
		+ d3.select("#embedding-height").property("value")
		+ "; border: 1px solid black;'>\n"
		+ "   <div id='embed-search'>" + getSearchFragment() + "</div>\n"
		+ "   <script src='http://d3js.org/d3.v3.min.js'></script>\n"
		+ "   <script id='provisualizer-script' src='" 
		+ baseUrl 
		+ "provisualizer.js'>\n"
		+ "   </script>\n"
		+ "</div>";
	var embeddingCodeWidget = d3.select("#embedding-code");
	embeddingCodeWidget.text(embeddingCode);
}
function toggleSharingToolbox() {
	var toolbox = d3.select("#sharing-toolbox");
	toolbox.classed("hidden", !(toolbox.classed("hidden")));
}
function hideSharingToolbox() {
	d3.select("#sharing-toolbox").classed("hidden", true);
}
function showSharingToolbox() {
		d3.select("#sharing-toolbox").classed("hidden", false);
}
function showHelp() {
	d3.select("#provisualizer .help").classed("hidden", false);
	d3.select("#show-help").attr("disabled", "disabled");
}

function hideHelp() {
	d3.select("#provisualizer .help").classed("hidden", true);
	d3.select("#show-help").attr("disabled", null);
}

function addHelp() {
	var help = provisualizer.append("div");
	help.classed("help", true);
	help.classed("hidden", true);
	help.style(
		{
			"left": "50px",
			"top": "50px"
			/*,
			"width": "700px",
			"height": "350px"
			*/
		}
	);
	var titleBar = help.append("div");
	titleBar.classed("titlebar", true);
	titleBar.text("Need Help?");
	titleBar.append("img")
			.attr("class", "close-button")
			.attr("src", baseUrl + "close.png")
			.attr("alt", "Close")
			.attr("title", "Close")
			.on("click", hideHelp);
	var dialogPanel = help.append("div");
	dialogPanel.classed("panel", true);
	var helpContent = dialogPanel.append("iframe")
		.attr("src", baseUrl + "help.html");
	/*
	var helpContent = dialogPanel.append("div");
	helpContent.classed("content", true);
	d3.xhr(baseUrl + "help.html", "text/html", function(error, response) {
			if (error) 
				return console.warn("Error loading help file");
			helpContent.html(response.response);
		}
	);
	*/
	
	var helpDrag = d3.behavior.drag();
	helpDrag.origin(
		function() {
			return {
				"x": provisualizer.node().offsetLeft,
				"y": provisualizer.node().offsetTop
			}
		}
	);
	helpDrag.on(
		"drag", 
		function(d, i) {
			// TODO constrain to fit within visualization?
			var left = help.node().offsetLeft + d3.event.dx;
			var top = help.node().offsetTop + d3.event.dy;
			help.style(
				{
					"left": left + "px",
					"top": top + "px"
				}
			);
		}
	);
	titleBar.on(
		"mousedown",
		function() {
			help.call(helpDrag);
		}
	);
	titleBar.on(
		"mouseup", 
		function() {
			help.on(".drag", null);
		}
	);
}

function startLabelFadeTimer() {
	d3.timer(
		function(ms) {
			nodeLabels
				.filter(
					function(d) {
						return d.fadeTime != null && d.fadeTime < Date.now();
					}
				)
				.classed(
					"selected", false
				)
				.each(
					function(label) {
						/*
						console.log(
							"Deleting fadeTime of " + 
							label.fadeTime +
							" at " + 
							Date.now()
						);
						*/
						label.fadeTime = null;	
						// if there are no more visible labels, disable the "hide labels" button
						if (d3.select("text.node.selected").empty()) {
							hideLabelsButton.attr("disabled", "disabled")
						};
					}
				);

			
			/* chaining transitions: 				http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
			*/
			/*
			.transition("fader")
			.attr("opacity", 0.0);
			*/
			
			return false;
		}
	);
}

function addEmbeddingGuide() {
	var embeddingGuide = provisualizer.append("div")
		.attr("id", "embedding-guide")
		.classed("hidden", "true");
	embeddingGuide.append("h1").attr("id", "embedding-guide-heading");
	embeddingGuide.append("img")
			.attr("class", "close-button")
			.attr("src", baseUrl + "close.png")
			.attr("alt", "Close")
			.attr("title", "Close")
			.on("click", hideEmbeddingGuide);
	embeddingGuide.append("p").text("Copy and paste this code into the website where you want to embed this visualization");
	embeddingGuide.append("textarea")
		.attr("id", "embedding-code")
		.on("focus", function() {
			// on focus, select all
			var widget = d3.select("#embedding-code");
			widget.node().setSelectionRange(0, widget.property("value").length);
		});
	var dimensions = embeddingGuide.append("div").attr("class", "dimensions");
	dimensions.append("label")
		.attr("for", "embedding-width")
		.text("Width:");
	dimensions.append("input")
		.attr("id", "embedding-width")
		.attr("type", "text")
		.attr("size", "6")
		.property("value", "800px")
		.on("input", updateEmbeddingCode);
	dimensions.append("label")
		.attr("for", "embedding-height")
		.text("Height:");
	dimensions.append("input")
		.attr("id", "embedding-height")
		.attr("type", "text")
		.attr("size", "6")
		.property("value", "500px")
		.on("input", updateEmbeddingCode);
}

function hideEmbeddingGuide() {
	d3.select("#embedding-guide").classed("hidden", true);
}

function getSearchTitle() {
	var searchText = d3.select("#agency-or-function-name-filter").text();
	var yearText = d3.select("#year-filter").text();
	//TODO
}

function addSearchForm() {
	// search for the word specified in the URL fragment identifier 
	
	// default search is for "soil", in no particular year
	var searchPhrase = "soil";
	var searchYear = "";
	
	// default is overridden by parameters in the html (i.e. an embedded provisualizer can specify a different default)
	var fragment;
	var embeddedSearchSpecifier = d3.select("#embed-search");
	if (! embeddedSearchSpecifier.empty()) {
		fragment = embeddedSearchSpecifier.text();
	}
	
	// URI fragment ("hash") overrides default again
	if (window.location.hash != "") {
		fragment = window.location.hash.substring(1);
	}
	if (fragment) {
		// trim the leading # and decode the fragment identifier
		var query = decodeURIComponent(fragment);
		var delimiter = query.indexOf("_");
		if (delimiter != -1) {
			// contains a phrase AND a year
			searchPhrase = query.substring(0, delimiter);
			searchYear = query.substring(delimiter + 1);
		} else {
			// just a phrase
			searchPhrase = query;
		}
	}
	toolBar = provisualizer.append("div").attr("id", "toolbar");
	toolBar.append("h1").text("PROVISUALIZER");
	toolBar.append("p").text("This visualization will give you a high-level view of the archives.");
	var searchForm = toolBar.append("form");
	var labelSearch = searchForm.append("label")
		.attr("id", "agency-or-function-name-label")
		.attr("for", "agency-or-function-name-filter")
		.text("Enter a keyword:");
	var textSearch = searchForm.append("input")
		.attr("id", "agency-or-function-name-filter")
		.attr("type", "text")
		.attr("size", "20")
		.property("value", searchPhrase);
	var functionListLabel = searchForm.append("label")
		.attr("id", "function-list-label")
		.attr("for", "function-list")
		.text("... or select a function: ");
	var functionList = searchForm.append("select")
		.attr("id", "function-list")
		.attr("class", "default") // defeat "JCF - JavaScript Custom Forms"
		// JCF would otherwise replace this select element with another one that may or may not work
		// JCF used on PROV's Drupal-based website.
		// NB similar problems are always possible on other sites.
		.on(
			"change", 
			function(d, i) {
				// this event is now handled
				d3.event.preventDefault();
				textSearch.property("value", functionList.property("value"));
				functionList.property("value", "(select)");
				performSearch();
			}
		);		
	var yearLabel = searchForm.append("label")
		.attr("id", "year-label")
		.attr("for", "year-filter")
		.text(" Year:");
	var yearSearch = searchForm.append("input")
		.attr("id", "year-filter")
		.attr("type", "text")
		.attr("size", "4")
		.attr("maxlength", "4")
		.property("value", searchYear);
	var allWordsLabel = searchForm.append("label")
		.attr("id", "all-words-label")
		.attr("for", "all-words")
		.text(" Contains all words or numbers");
	var allWords = searchForm.append("input")
		.attr("id", "all-words")
		.attr("type", "checkbox")
		.attr("checked", "checked");
	var submitButton = searchForm.append("input")
		.attr("id", "submit")
		.attr("type", "submit")
		.property("value", "Search");
		
	searchForm
		.on(
			"submit", 
			function(d, i) {
				// this event is now handled
				d3.event.preventDefault();
				performSearch();
			}
		);
		
	hideLabelsButton = searchForm.append("input")
		.attr("id", "hide-labels")
		.attr("type", "submit")
		.attr("disabled", "disabled")
		.property("value", "Hide Labels");
	
	hideLabelsButton.on(
		"click",
		function(d, i) {
			// this event is now handled
			d3.event.preventDefault();
			nodeLabels.classed("selected", false);
			hideLabelsButton.attr("disabled", "disabled");
		}
	);
	
	showHelpButton = searchForm.append("input")
		.attr("id", "show-help")
		.attr("type", "submit")
		.property("value", "Show Help");
		
	showHelpButton.on(
		"click",
		function(d, i) {
			// event handled; no further processing needed
			d3.event.preventDefault();
			showHelp();
		}
	);
	
	zoomToFitButton = searchForm.append("input")
		.attr("type", "submit")
		.property("value", "Zoom to fit");
		
	zoomToFitButton.on(
		"click",
		function(d, i) {
			d3.event.preventDefault();
			resetManualZoom();
		}
	);

	updateUri();
	return searchForm;
}

function matchesTextFilter(text) {
	var textFilter = d3.select('#agency-or-function-name-filter').property("value").toUpperCase();
	return text.toUpperCase().indexOf(textFilter) != -1
}

function matchesDateFilter(period) {
	var yearFilterText = d3.select('#year-filter').property("value");
	if (yearFilterText == "") {
		return true; // all records match a blank year filter
	}
	
	/* Example date ranges and their interpretations:
	
	ND-1851				x <= 1851
	c 1976-ct				1976 <= x <= current year
	c 1886-1905			1886 <= x <= 1905
	by 1921-by 1921		1921 <= x <= 1921 (i.e. x=1921)
	2010-2013 			2010 <= x <= 2013
	1987-by 2002			1987 <= x <= 2002
	1981-1981 - 1988	1981 <= x <= 1988
	1936-? 1994 			1936 <= x <= 1994
	? 1869-ct 				1869 <= x <= current year
	*/
	/* parsing date ranges:
	discard all chars not in "-0123456789"
	first date is text before "-"
	last date is text after final "-"
	if first date is blank, set it to "1770" (the year of Cook's first visit to Australia)
	if last date is blank, set it to the current year
	*/
	var cleanPeriod = period.replace(/[^-\d]*/g, "");
	var startYearGiven = cleanPeriod.substr(0, cleanPeriod.indexOf("-"));
	var endYearGiven = cleanPeriod.substr(1 + cleanPeriod.lastIndexOf("-"));
	var startYear, endYear;
	if (startYearGiven == "") {
		startYear = 1770;
	} else {
		startYear = Number(startYearGiven);
	}
	if (endYearGiven == "") {
		endYear = new Date().getFullYear();
	} else {
		endYear = Number(endYearGiven);
	}	
	// console.log(period, cleanPeriod, startYear, endYear);
	var yearFilter = Number(yearFilterText);
	return (startYear <= yearFilter) && (endYear >= yearFilter);
}

function populateFunctionDropDownList() {
	var functionList = d3.select("#function-list");
	functionList.append("option")
		.text("(select)");
	for(var functionName in uniqueFunctionNames) 
		functionList.append("option")
			.text(functionName);
}

function performSearch() {
	createFilteredGraphFromLinks();
	updateUri();
	resetManualZoom();
}

function updateUri() {
	window.location.hash = "#" + getSearchFragment();
}	

function getSearchFragment() {
	var textSearch = d3.select("#agency-or-function-name-filter");
	var yearSearch = d3.select("#year-filter");
	searchPhrase = textSearch.property("value");
	searchYear = yearSearch.property("value");
	if (searchYear == "") {
		 return encodeURIComponent(searchPhrase);
	} else {
		return encodeURIComponent(searchPhrase + "_" + searchYear);
	}
}
	

	
	// zoom and pan
	function zoom() {
		//console.log("translate: ", d3.event.translate, ", scale: ", d3.event.scale);
		svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		// once the user has zoomed manually, they should be able to use the 'Zoom to fit" button 
		// reset the zoom (so that it displays the entire visualization).
		zoomToFitButton.attr("disabled", null);
   	}
   	
   	function resetManualZoom() {
		zoomBehavior.translate([0, 0]);
		zoomBehavior.scale(1);
		zoomBehavior.event(svg);	
		// once the manual zoom is reset (and hence will be showing the entire visualization)
		// the "zoom to fit" button does not apply until the user manually zooms again
		zoomToFitButton.attr("disabled", "disabled");
   	}
	
   	function zoomToFit() {
   		var bbox = svg.node().getBBox();
   		var toolbarHeight = toolBar.node().clientHeight;
   		var svgHeight = svg.node().getBoundingClientRect().height;
   		var viewBox = outerSvg.attr("viewBox");
		if (viewBox == null) {
			outerSvg.attr(
				"viewBox", 
				bbox.x + " " + 
				bbox.y + " " + 
				bbox.width + " " + 
				bbox.height
			);
		} else{
			var viewBoxValues = viewBox.split(" ");
			var viewBoxX = parseFloat(viewBoxValues[0]);
			var viewBoxY = parseFloat(viewBoxValues[1]);
			var viewBoxWidth = parseFloat(viewBoxValues[2]);
			var viewBoxHeight = parseFloat(viewBoxValues[3]);
			// "smoothing" is weighting given to the status quo viewbox when combining it 
			// with a desired new viewbox. This keeps the viewbox relatively stable
			// without jittering about due to small sub-graphs flying about in cometary orbits.
   			var smoothing = 3; 
   			var newY = (bbox.y + smoothing * viewBoxY) / (smoothing + 1) ;
   			var newHeight = (bbox.height + smoothing * viewBoxHeight) / (smoothing + 1) ;
			outerSvg.attr(
				"viewBox", 
				(bbox.x + smoothing * viewBoxX) / (smoothing + 1) + " " + 
				newY + " " + 
				(bbox.width + smoothing * viewBoxWidth) / (smoothing + 1) + " " + 
				newHeight
			);
		}
   	}

   	function mouseover(node, index) {
   		// labels don't need box; just a label by itself
   		//popup.style("left", d3.event.pageX + "px");
   		//popup.style("top", d3.event.pageY + "px");
   		//popup.style("display", "inline");
   		var labels = nodeLabels
   			.filter(
   				function(d) {
   					return d == node;
   				}
   			)
   			.classed(
   				"selected", true
   			);
   		//if (! labels.empty()) {
   			// enable the "hide labels button")
   			hideLabelsButton.attr("disabled", null);
   		//}
   		
   		var connectedLines = svg.selectAll(".link")
   			.filter(
   				function(d) {
   					return d.source == node || d.target == node;
   				}
   			);
   		connectedLines.classed("highlighted", true);
   	}
   	
   	function mouseout(node, index) {
   		// labels don't need box; just a label by itself
   		//popup.style("display", "none");
   		//d3.select(this).style("display", "none"); 
   		// disabled hiding of labels, once shown they remain visible, see 
   		// <https://github.com/Conal-Tuohy/Provisualizer/issues/11#issuecomment-184508962>
   		// var labels = nodeLabels.classed("selected", false);
   		var connectedLines = svg.selectAll(".link").classed("highlighted", false);
   		var labels = nodeLabels
   			.filter(
   				function(d) {
   					return d == node;
   				}
   			)
   			.each(
   				function(label) {
   					label.fadeTime = Date.now() + labelFadeDelay;
   				}
   			);
   	}
