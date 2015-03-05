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


// search for the word specified in the URL fragment identifier 
var searchPhrase = "road";
var fragment = window.location.hash;
if (fragment) {
	// trim the leading # and decode the fragment identifier
	searchPhrase = decodeURIComponent(fragment.substring(1));
}

var searchForm = provisualizer.append("form");
var textSearch = searchForm.append("input")
	.attr("type", "text")
	.attr("width", "180px")
	.attr("height", "80px")
	.property("value", searchPhrase);
	
searchForm
	.on(
		"submit", 
		function(d, i) {
			// this event is now handled
			d3.event.preventDefault();
			createFilteredGraphFromLinks();
			window.location.hash = "#" + encodeURIComponent(textSearch.property("value"));
		}
	);

	

	
var force = d3.layout.force()
	.size([width, height])
	.charge(-400)
	.chargeDistance(350)
	.linkDistance(50)
	.on("tick", tick);

var drag = force.drag()
	.on("dragstart", dragstart);

var svg = d3.select("#provisualizer").append("svg")
	.attr("width", "100%")
	.attr("height", "100%");
	
	
	var linkLines = svg.selectAll(".link");
	var nodeCircles = svg.selectAll("circle.node");	
	var nodeLabels = svg.selectAll("text.node");
	
	// array of rows read from CSV (unfiltered)
	var agencyFunctionRelationships = [];

	// map from node names to node attributes
	var nodeAttributesByNodeName = {};
		
d3.csv(
	baseUrl + "data/nodes.csv", 
	function(error, nodeAttributes) {

		nodeAttributes.forEach(
			function(nodeAttributeSet) {
				nodeAttributesByNodeName[nodeAttributeSet.FUNCTION] = nodeAttributeSet; // though we don't really need to copy the FUNCTION column
			}
		);
		// Now these node attributes can be read below
		// Note: the "FUNCTION" columns is misnamed because it includes both functions AND agencies
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
	window.location = d.URL
}

function createFilteredGraphFromLinks() {
	// Extract the distinct nodes from the node relationship table.
	var nameFilter = textSearch.property("value").toUpperCase();
	
	// arrays containing the node objects, and the link objects, for D3 force layout
	var nodes = [];
	var links = [];
	// map from node names to node array indices
	var nodeIndicesByNodeName = {};
	
	agencyFunctionRelationships.forEach(
		function(agencyFunctionRow) {
			
			if (agencyFunctionRow.FUNCTION.toUpperCase().indexOf(nameFilter) != -1 || agencyFunctionRow.AGENCY.toUpperCase().indexOf(nameFilter) != -1) {
			
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
