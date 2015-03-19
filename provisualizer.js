var script = d3.select('#provisualizer-script').attr('src');
var baseUrl = script.substring(0, script.lastIndexOf('provisualizer.js'));
if (baseUrl == "") {
	baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/";
}

// add CSS stylesheet
var stylesheet = d3.select('head')
	.append('link')
		.attr('type', 'text/css')
		.attr('rel', 'stylesheet')
		.attr('href', baseUrl + 'provisualizer.css');

var maxLabelLength = 30;
var provisualizer = d3.select("#provisualizer").append("div")
	.attr("style", "width: 100%; height: 100%; margin: 0; padding: 0; background-color: white;");
var width = provisualizer.node().offsetWidth; 
var height = provisualizer.node().offsetHeight; 

var force = d3.layout.force()
	.size([width, height])
	.charge(
		function(node) {
			return -200 * node.weight;
		}
	)
	.chargeDistance(350)
	.linkDistance(
		function(link, index) {
			//return 80;
			//return 20 + Math.sqrt(link.source.weight + link.target.weight);
			return 30 + (Math.sqrt(link.source.weight) + Math.sqrt(link.target.weight)) * 10;
		}
	)
	.on("tick", tick);

var drag = force.drag()
	.on("dragstart", dragstart);

addSearchForm();
addSharingTools();
addFullscreenButton();
addEmbeddingGuide();

var svg = provisualizer.append("svg")
	.attr("width", "100%")
	.attr("height", "100%") 
    		.call(d3.behavior.zoom().on("zoom", zoom))
    	.append("g");
	
	
	var linkLines = svg.selectAll(".link");
	var nodeCircles = svg.selectAll("circle.node");	
	var nodeLabels = svg.selectAll("text.node");
	
	// array of rows read from CSV (unfiltered)
	var agencyFunctionRelationships = [];

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
				if (nodeAttributeSet.FUNCTION.substr(0, 2) == "VF") {
					// then it is a function, not an agency
					functionNames.push(nodeAttributeSet.FUNCTION);
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
				nodeAttributesByNodeName[nodeAttributeSet.FUNCTION] = nodeAttributeSet; // though we don't really need to copy the FUNCTION column
			}
		);
		// Now these node attributes can be read below
		// Note: the "FUNCTION" column is misnamed because it includes both functions AND agencies; it should be NODE.
		// Also the table should really have included a TYPE column to specify "function" or "agency"
		d3.csv(
			baseUrl + "data/agency-functions.csv", 
			function(error, agencyFunctionRelationshipsCSV) {
				agencyFunctionRelationships = agencyFunctionRelationshipsCSV;
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
		.attr("x", function(d) { return d.x; })
		.attr("y", function(d) { return d.y; });
	nodeCircles
		.attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; });
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

function createFilteredGraphFromLinks() {
	// Extract the distinct nodes from the node relationship table.
	
	// arrays containing the node objects, and the link objects, for D3 force layout
	var nodes = [];
	var links = [];
	// map from node names to node array indices
	var nodeIndicesByNodeName = {};
	
	agencyFunctionRelationships.forEach(
		function(agencyFunctionRow) {
			var agencyPeriod = nodeAttributesByNodeName[agencyFunctionRow.AGENCY].PERIOD;
			if (
				matchesDateFilter(agencyPeriod) &&
				(matchesTextFilter(agencyFunctionRow.FUNCTION) || matchesTextFilter(agencyFunctionRow.AGENCY))
			) {
			
				if (! (agencyFunctionRow.AGENCY in nodeIndicesByNodeName)) {
					// no node with that name yet
					var newNodeIndex = nodes.length;
					var agencyNode =  {
						name: agencyFunctionRow.AGENCY,
						type: "agency"
					};
					var nodeAttributes = nodeAttributesByNodeName[agencyFunctionRow.AGENCY];
					for(var p in nodeAttributes) agencyNode[p]=nodeAttributes[p];
					nodes[newNodeIndex] = agencyNode;
					nodeIndicesByNodeName[agencyFunctionRow.AGENCY] = newNodeIndex;
					addNodeLabel(agencyNode, nodes, links);
				}
				if (! (agencyFunctionRow.FUNCTION in nodeIndicesByNodeName)) {
					// no node with that name yet
					var newNodeIndex = nodes.length;
					var functionNode = {
						name: agencyFunctionRow.FUNCTION,
						type: "function"
					};
					var nodeAttributes = nodeAttributesByNodeName[agencyFunctionRow.FUNCTION];
					for(var p in nodeAttributes) functionNode[p]=nodeAttributes[p];
					nodes[newNodeIndex] = functionNode;
					nodeIndicesByNodeName[agencyFunctionRow.FUNCTION] = newNodeIndex;
					addNodeLabel(functionNode, nodes, links);
				}
				links.push(
					{
						source: nodes[nodeIndicesByNodeName[agencyFunctionRow.AGENCY]],
						target: nodes[nodeIndicesByNodeName[agencyFunctionRow.FUNCTION]]
					}
				)
			}
		}
	);
	
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
			.attr(
				"title",
				function(n) {
					return n.name;
				}
			)
			.attr(
				"r", 
				function(n) {
					//return 10;
					return Math.sqrt(n.weight) * 10;
				}
			)
			// opacity depends on the node degree - node with infinite degree would be solid, degree 1 would be almost transparent
			.style(
				"fill-opacity", 
				function(n) {
					return 1 - (.8/ n.weight);
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
				"title",
				function(n) {
					return n.name;
				}
			)
			.on("mouseover", mouseover)
			.on("mouseout", mouseout)
			.on("click", jump);	
			

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
		var fullScreenButton = provisualizer.append("img")
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
	return  document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled;
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
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	}
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
	embeddingCodeWidget.node().setSelectionRange(0, embeddingCodeWidget.property("value").length);
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
	embeddingGuide.append("textarea").attr("id", "embedding-code");
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
	
	// default search is for "road", unconstrained by date
	var searchPhrase = "road";
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
	var toolBar = provisualizer.append("div");
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
		.text("... or select a function:");
	var functionList = searchForm.append("select")
		.attr("id", "function-list")
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
		.text("Year:");
	var yearSearch = searchForm.append("input")
		.attr("id", "year-filter")
		.attr("type", "text")
		.attr("size", "4")
		.attr("maxlength", "4")
		.property("value", searchYear);
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
		svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
   	}

   	function mouseover(node) {
   		var connectedLines = svg.selectAll(".link")
   			.filter(
   				function(d) {
   					return d.source == node || d.target == node;
   				}
   			);
   		connectedLines.classed("highlighted", true);
   	}
   	
   	function mouseout() {
   		var connectedLines = svg.selectAll(".link").classed("highlighted", false);
   	}
