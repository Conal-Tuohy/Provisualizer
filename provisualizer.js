var script = d3.select('#provisualizer-script').attr('src');
var baseUrl = script.substring(0, script.lastIndexOf('provisualizer.js'));

// add stylesheet
var stylesheet = d3.select('head')
	.append('link')
		.attr('type', 'text/css')
		.attr('rel', 'stylesheet')
		.attr('href', baseUrl + 'provisualizer.css');

var maxLabelLength = 30;
var provisualizer = d3.select("#provisualizer");
var width = provisualizer.node().offsetWidth; 
var height = provisualizer.node().offsetHeight; 

var force = d3.layout.force()
	.size([width, height])
	.charge(-400)
	.chargeDistance(350)
	.linkDistance(50)
	.on("tick", tick);

var drag = force.drag()
	.on("dragstart", dragstart);

addSearchForm();
var svg = provisualizer.append("svg")
	.attr("width", "100%")
	.attr("height", "100%");
	
	
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
  d3.select(this).classed("fixed", d.fixed = false);
}

function dragstart(d) {
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

function addSearchForm() {
	// search for the word specified in the URL fragment identifier 
	var searchPhrase = "road";
	var searchYear = "";
	var fragment = window.location.hash;
	if (fragment) {
		// trim the leading # and decode the fragment identifier
		var query = decodeURIComponent(fragment.substring(1));
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
	var searchForm = provisualizer.append("form");
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
	var textSearch = d3.select("#agency-or-function-name-filter");
	var yearSearch = d3.select("#year-filter");
	searchPhrase = textSearch.property("value");
	searchYear = yearSearch.property("value");
	if (searchYear == "") {
		window.location.hash = "#" + encodeURIComponent(searchPhrase);
	} else {
		window.location.hash = "#" + encodeURIComponent(searchPhrase + "_" + searchYear);
	}
}	
