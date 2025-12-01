/* 
   Copyright 2016, 2025 Conal Tuohy

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
class PROVisualizer extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.shadowRoot.innerHTML = `
			<div id="provisualizer">
				<slot></slot>
			</div>
		`;
		this.initialized = false;
	}

	connectedCallback() {
		if (this.initialized) {
			// the widget is alsready initialised, so nothing needs to be done
			return;
		}
		this.initialized = true;

		// Get the base URL from the script location
		//const provisualizerScript = document.currentScript.src;
		this.baseUrl = this.getAttribute("base-url");

		// Add CSS to shadow DOM
		const style = document.createElement('link');
		style.rel = 'stylesheet';
		style.href = this.baseUrl + 'provisualizer.css';
		this.shadowRoot.appendChild(style);


        const script = document.createElement('script');
        script.src = '//d3js.org/d3.v3.min.js';
        this.shadowRoot.appendChild(script);		

		// Initialize the visualization after D3 loads
        script.onload = () => {
			this.initializeVisualization();
        };
/*		style.onload = () => {
			this.initializeVisualization();
		};
		*/
	}

initializeVisualization() {

this.maxLabelLength = 50;
this.provisualizer = d3.select(this.shadowRoot).select("#provisualizer");
//.append("div")
//	.attr("style", "position: relative; width: 100%; height: 100%; margin: 0; padding: 0; background-color: white;");
this.width = this.provisualizer.node().offsetWidth; 
this.height = this.provisualizer.node().offsetHeight; 
//this.labelFadeTime = 3000;
this.labelFadeDelay = 10000;
this.toolBar = null;
this.addSearchForm();
this.visualizationContainerDiv = this.provisualizer.append("div")
	.attr("class", "visualizationContainer");
this.addSharingTools();
this.addFullscreenButton();
this.addEmbeddingGuide();
this.addZeroResultsDialog();
this.addHelp();
this.addKey();

this.force = d3.layout.force()
	.friction(0.95)
	.gravity(0.08)
	.size([this.width, this.height])
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
	.on("tick", this.tick.bind(this));

this.drag = this.force.drag()
	.on("dragstart", this.dragstart.bind(this));


//startLabelFadeTimer();
this.zoomBehavior = d3.behavior.zoom();
this.outerSvg =this.visualizationContainerDiv.append("svg")
	.attr("class", "visualization")
	.call(this.zoomBehavior.on("zoom", this.zoom.bind(this)));

this.svg = this.outerSvg
		.append("g");


this.linkLines = this.svg.selectAll(".link");
this.nodeCircles = this.svg.selectAll("circle.node");	
this.nodeLabels = this.svg.selectAll("text.node");

// array of rows read from CSV (unfiltered)
var edges = [];

// map from node names to node attributes
this.nodeAttributesByNodeName = {};

// list of function names
this.functionNames = [];
this.uniqueFunctionNames = {};
		
d3.csv(
	this.baseUrl + "data/nodes.csv", 
	function(error, nodeAttributes) {
		nodeAttributes.forEach(
			function(nodeAttributeSet) {
				if (nodeAttributeSet.NAME.substr(0, 2) == "VF") {
					// then the node represents a function, not an agency or series
					this.functionNames.push(nodeAttributeSet.NAME);
				}
			}.bind(this)
		);
		this.functionNames.sort(this.functionNameComparator.bind(this)); // so that the list box of functions is sorted
		this.functionNames.forEach(
			function(functionName) {
				this.uniqueFunctionNames[functionName] = functionName;
			}.bind(this)
		);
		this.populateFunctionDropDownList();
		nodeAttributes.forEach(
			function(nodeAttributeSet) {
				this.nodeAttributesByNodeName[nodeAttributeSet.NAME] = nodeAttributeSet; 
			}.bind(this)
		);
		// Now these node attributes can be read below
		d3.csv(
			this.baseUrl + "data/edges.csv", 
			function(error, edgesCSV) {
				this.edges = edgesCSV;
				this.createFilteredGraphFromLinks();
			}.bind(this)
		)
	}.bind(this)
);
}
functionNameComparator(a, b) {
	if (this.functionNameExcludingCode(a) < this.functionNameExcludingCode(b)) {
		return -1;
	} else {
		return 1;
	}
}
functionNameExcludingCode(functionNameWithCode) {
	const n = functionNameWithCode.substr(3).indexOf(" ") + 4;
	return functionNameWithCode.substr(n);
}

tick() {
	this.linkLines
		.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
	this.nodeLabels
		.attr("x", function(d) { 
			if (d.x > this.width / 2)
				return d.x + 15;
			else
				return d.x - 15;
		}.bind(this))
		.attr("y", function(d) { return d.y; });
	this.nodeLabels.classed("right-aligned", function(d) {
			return d.x * 2 < this.width;
	}.bind(this));
	this.nodeCircles
		.attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; });
	this.zoomToFit();
}

dblclick(d) {
	// don't propagate the event, otherwise the zoom/pan behaviour will handle it and
	// effectively nullify the dragging of this individual node
	d3.event.stopPropagation();
	// mark the node as not being fixed in place - it can float freely
	d3.select(this).classed("fixed", d.fixed = false);
}

dragstart(d) {  
	// don't propagate the event, otherwise the zoom/pan behaviour will handle it and
	// effectively nullify the dragging of this individual node
	d3.event.sourceEvent.stopPropagation();
	// mark the node as being fixed in place
	d3.select(this).classed("fixed", d.fixed = true);
}

jump(d) {
	window.open(d.URL, "_self");
	// window.open(d.URL, d.name);
}

includeNode(nodeName, nodes, nodeIndicesByNodeName) {
	if (! (nodeName in nodeIndicesByNodeName)) {
		// no node with that name yet
		var newNodeIndex = nodes.length;
		var displayNode =  {
			name: nodeName,
			type: nodeName.substr(0, nodeName.indexOf(" ")) // "VF", "VA", or "VPRS"
		};
		var nodeAttributes = this.nodeAttributesByNodeName[nodeName];
		for(const p in nodeAttributes) displayNode[p]=nodeAttributes[p];
		nodes[newNodeIndex] = displayNode;
		nodeIndicesByNodeName[nodeName] = newNodeIndex;
	}
}

updateKeyItem(className, label, nodes) {
	const filteredNodes = nodes.filter(
		function(node) {
			return node.type==className;
		}
	);
	this.provisualizer.select(".key text." + className).text(label + " (" + filteredNodes.length + " shown)");
}

createFilteredGraphFromLinks() {
	// Extract the distinct nodes from the node relationship table.
	
	// arrays containing the node objects, and the link objects, for D3 force layout
	const nodes = [];
	const links = [];
	// map from node names to node array indices
	const nodeIndicesByNodeName = {};

	const textFilter = this.provisualizer.select('#agency-or-function-name-filter').property("value").toUpperCase();
	const matchWholeWords = this.provisualizer.select('#whole-words').property("checked");
	// treat the query text as a set of whitespace-delimited tokens, all of which must be present
	const textFilterTokens = textFilter.split(/\s/);
	
	this.edges.forEach(
		function(edge) {
			var sourcePeriod = this.nodeAttributesByNodeName[edge.SOURCE].PERIOD;
			var targetPeriod = this.nodeAttributesByNodeName[edge.TARGET].PERIOD;
			var edgeText = " " + (edge.SOURCE + " " + edge.TARGET).toUpperCase() + " ";
			if (
				// both nodes in the edge must match the date filter
				// the combined text of both nodes must match all the search tokens
				this.matchesDateFilter(sourcePeriod) &&
				this.matchesDateFilter(targetPeriod) &&
				textFilterTokens.every(
					function(textFilterToken) {
						const index = edgeText.indexOf(textFilterToken);
						if (index != -1) {
							if (matchWholeWords) {
								// token was found, check if the match is a whole word
								var startsWord =/\s/.test(edgeText.charAt(index - 1));
								var endsWord = /\s/.test(edgeText.charAt(index + textFilterToken.length));
								return startsWord && endsWord;
							} else { // token was found, match-whole-words not checked - that counts as a match
								return true;
							}
						} else {
							return false;
						}
					}
				)
			) {
				this.includeNode(edge.SOURCE, nodes, nodeIndicesByNodeName);
				this.includeNode(edge.TARGET, nodes, nodeIndicesByNodeName);
				links.push(
					{
						source: nodes[nodeIndicesByNodeName[edge.SOURCE]],
						target: nodes[nodeIndicesByNodeName[edge.TARGET]]
					}
				)
			}
		}.bind(this)
	);
	
	// update key with hit counts
	this.updateKeyItem("VPRS", "Series", nodes);
	this.updateKeyItem("VA", "Agencies", nodes);
	this.updateKeyItem("VF", "Functions", nodes);
	
	if (nodes.length == 0) {
		this.showZeroResultsDialog();
	} else {
		const theta = 2 * 3.14159 * Math.sqrt(nodes.length);
		const xCentre = 0;//width * 0.5;
		const yCentre = 0;//height * 0.5;
		const r = 3 * Math.sqrt((this.width * this.width) + (this.height * this.height)) / (nodes.length * nodes.length);
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].x = xCentre + Math.cos(theta * i) * r *  (nodes.length - i) * (nodes.length - i);
			nodes[i].y = yCentre + Math.sin(theta* i) *  r *  (nodes.length - i) * (nodes.length - i);
		}
	}	
	// create force layout
	this.force
		.nodes(nodes)
		.links(links)
		.start();
		
	// (re-)populate force layout


	this.linkLines = this.linkLines.data(
		links,
		function(d) {
			return d.source.name + "->" + d.target.name;
		}
	);
	this.linkLines.exit().remove();
	this.linkLines
		.enter().append("line")
		.attr("class", "link");
	

	this.nodeCircles = this.nodeCircles.data(
		nodes,
		function(d) { 
			return d.name + d.type; 
		}
	);
	
	this.nodeCircles.exit().remove();
	
	this.nodeCircles.enter()
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
			.on("dblclick", this.dblclick.bind(this))
			.on("mouseover", this.mouseover.bind(this))
			.on("mouseout", this.mouseout.bind(this))
			.call(this.drag);		
			
	this.nodeLabels = this.nodeLabels.data(
		nodes,
		function(d) { 
			return d.name + d.type; 
		}
	);
	
	this.nodeLabels.exit().remove();
	this.nodeLabels.enter()
		.append("text")
			.attr(
				"class", 
				function(n) { 
					return n.type + " node label";
				}
			)
			.text( 
				function (n) { 
					if (n.name.length > this.maxLabelLength) 
						return n.name.substring(0, this.maxLabelLength) + "..."
					else
						return n.name; 
				}.bind(this)
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
			.on("mouseover", this.mouseover.bind(this))
			.on("mouseout", this.mouseout.bind(this))
			.on("click", this.jump.bind(this));	
			
	const ticks = 10;
	const startTime = new Date().getTime();
	for (var i = 0; i < ticks; ++i) this.force.tick();
	var endTime = new Date().getTime();
	console.log("Force layout ran for", ticks, "ticks, in", endTime - startTime, "ms");
		
}

addFullscreenButton() {
	if (this.fullscreenEnabled()) {
		const fullScreenButton = this.visualizationContainerDiv.append("img")
			.attr("id", "full-screen-button")
			.attr("src", this.baseUrl + "fullscreen.png")
			.attr("alt", "Toggle full screen")
			.attr("title", "Toggle full screen")
			.on("click", this.toggleFullscreen.bind(this));
	}
	d3.select(document); // TODO is this dead code?
		
}

toggleFullscreen() {
	if (this.fullscreenElement() == null) {
		this.goFullscreen(this.provisualizer.node());
	} else {
		this.exitFullscreen();
	}
}

fullscreenEnabled() {
	return  document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
}

fullscreenElement() {
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

goFullscreen(element) {
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

exitFullscreen() {
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

addZeroResultsDialog() {
	const zeroResultsDialog = this.createDialog("No matches found", "zero-results-dialog");
	zeroResultsDialog.append("p")
		.text("Your search turned up no results, please try again with a broader search.");
	this.zeroResultsDialog = zeroResultsDialog.node();
}

showZeroResultsDialog() {
	this.zeroResultsDialog.showModal();
}

addSharingTools() {
		const shareButton = this.visualizationContainerDiv.append("img")
			.attr("id", "share-button")
			.attr("src", this.baseUrl + "share.png")
			.attr("alt", "Share")
			.attr("title", "Share")
			.on("click", this.showSharingToolbox.bind(this));
			
		const sharingToolbox = this.createDialog("Share your search", "sharing-toolbox");
		// <a href="https://www.facebook.com/sharer/sharer.php?u={url}">Share on Facebook</a>
			
		var shareList = sharingToolbox.append("div")
			.attr("class", "ss-share");
			
		this.addTool(shareList, "ico-facebook", "Facebook", this.shareOnFacebook.bind(this));
		this.addTool(shareList, "ico-x", "X", this.shareOnTwitter.bind(this));
		this.addTool(shareList, "ico-email", "Email", this.shareByEmail.bind(this));
		this.addTool(shareList, "ico-embed","Embed", this.shareByEmbedding.bind(this));
		this.sharingToolbox = sharingToolbox.node();
}

addTool(shareList, cssClass, name, eventHandler) {
		shareList.append("a")
			.attr("class", "ss-share-link " + cssClass)
			.on("click", eventHandler)
			.text(name);
}

shareOnFacebook() {
	var URL = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location);
	window.open(URL, "Share");
	this.closeSharingToolbox();
}

shareOnTwitter() {
	const search = this.textSearch.property("value");
	const tweet = "Visualized'" + search + "' at @PRO_Vic: " + window.location;
	const URL = "https://x.com/intent/tweet?text=" + encodeURIComponent(tweet);
	console.log(URL);
	window.open(URL, "Share");
	this.closeSharingToolbox();
}

shareByEmail() {
	const search = this.textSearch.property("value");
	var subject = "Visualization of '" + search + "'";
	var message = "Check out this visualization of a search for '" + search + "' at PROV: <" + window.location + ">";
	var URL = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(message);
	console.log(URL);
	window.open(URL);
	this.closeSharingToolbox();
}

shareByEmbedding() {
	this.embeddingGuide.showModal();
	this.updateEmbeddingCode();
	this.closeSharingToolbox();
}

closeSharingToolbox() {
	this.sharingToolbox.close();
}

updateEmbeddingCode() {
	const embeddingCode = 
		"<script src='" + this.baseUrl + "provisualizer.js'></script>\n" +
		"<provisualizer-widget base-url='" + this.baseUrl + "'>\n" +
		"   <div id='embed-search' style='display: none'>" + this.getSearchFragment() + "</div>\n" +
		"</provisualizer-widget>";
	var embeddingCodeWidget = this.provisualizer.select("#embedding-code");
	embeddingCodeWidget.text(embeddingCode);
}

showSharingToolbox() {
	this.sharingToolbox.showModal();
}

showHelp() {
	this.help.showModal();
}

/*
	Create a modal dialog box with a title and a class attribute
*/
createDialog(title, dialogClass) {
	const dialog = this.provisualizer.append("dialog")
		.attr("class", dialogClass)
		.attr("closedBy", "any");
	const header = dialog.append("header");
	header.append("h1").text(title);
	header.append("button")
		.attr("title", "Close")
		.attr("class", "close-button")
		.on("click", function() {dialog.node().close()})
		.text("❌︎ Close");
	return dialog;
}

addHelp() {
	const help = this.createDialog("Need Help?", "help");
	const helpContent = help.append("iframe")
		.attr("src",this.baseUrl + "help.html");
	this.help = help.node();
}

startLabelFadeTimer() {
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
							this.hideLabelsButton.attr("disabled", "disabled")
						};
					}.bind(this)
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

addKey() {
	const keySvg =this.visualizationContainerDiv.append("svg")
		.attr("class", "key")
		.attr("viewBox", "0 0 270 150");
	keySvg.append("text")
		.attr("class", "key-heading")
		.attr("x", "135")
		.attr("y", "20")
		.text("Key");
		
	this.addKeyLine(keySvg, 20, 50, 40, 90, "Agencies create series of records");
	this.addKeyLine(keySvg, 20, 130, 40, 90, "Agencies administer functions");
	this.addKeyItem(keySvg, "VPRS", "Series", 20, 50);
	this.addKeyItem(keySvg, "VA", "Agencies", 40, 90);
	this.addKeyItem(keySvg, "VF", "Functions", 20, 130);
}

addKeyLine(keySvg, x1, y1, x2, y2, text) {
	keySvg.append("line")
		.attr("class", "link")
		.attr("x1", (x1).toString())
		.attr("y1", (y1).toString())
		.attr("x2", (x2).toString())
		.attr("y2", (y2).toString())
		.attr("title", text); // TODO revise; this SVG title is not displayed
}

addKeyItem(keySvg, className, text, x, y) {
	var circle = keySvg.append("circle")
		.attr("class", className + " node")
		.attr("r", "10")
		.attr("cx", (x).toString())
		.attr("cy", (y).toString())
		.attr("style", "fill-opacity: 0.5")
		.attr("title", text);
	var seriesLabel = keySvg.append("text")
		.attr("class", className + " key-node-label")
		.attr("x", (x + 15).toString())
		.attr("y", (y + 6).toString())
		.text(text);
}

addEmbeddingGuide() {
	const embeddingGuide = this.createDialog("Embed PROVisualizer", "embedding-guide");
	embeddingGuide.append("p").text("Copy and paste this code into the website where you want to embed this visualization");
	embeddingGuide.append("textarea")
		.attr("id", "embedding-code")
		.on("focus", function() {
			// on focus, select all
			const widget = d3.select("#embedding-code");
			widget.node().setSelectionRange(0, widget.property("value").length);
		});
	this.embeddingGuide = embeddingGuide.node();
}

getSearchTitle() {
	var searchText = d3.select("#agency-or-function-name-filter").text();
	var yearText = d3.select("#year-filter").text();
}

addSearchForm() {
	// search for the word specified in the URL fragment identifier 
	
	// default search is for "soil", in no particular year
	var searchPhrase = "soil";
	var searchYear = "";
	var wholeWords = "";
	
	// default is overridden by parameters in the html (i.e. an embedded provisualizer can specify a different default)
	var fragment;
	var embeddedSearchSpecifier = d3.select("#embed-search");
	if (! embeddedSearchSpecifier.empty()) {
		fragment = embeddedSearchSpecifier.text();
	}
	
	// URI fragment ("hash") overrides default again
	// FIXME startsWith('more-') is a crude hack to exclude fragments created by WordPress's "more" links 
	if (window.location.hash != "") {
		if (! window.location.hash.startsWith('#more-')) {
			fragment = window.location.hash.substring(1);
		}
	}
	if (fragment) {
		// trim the leading # and decode the fragment identifier
		var query = decodeURIComponent(fragment);
		var queryFields = query.split(/_/);
		if (queryFields.length >= 1) {
			searchPhrase = queryFields[0];
			if (queryFields.length >= 2) {
				searchYear = queryFields[1];
				if (queryFields.length >= 3) {
					wholeWords = queryFields[2];
				}
			}
		} else {
			// just a phrase
			searchPhrase = query;
		}
	}
	const toolBar = this.provisualizer.append("div").attr("id", "toolbar");
	toolBar.append("h1").text("PROVISUALIZER");
	toolBar.append("p").text("This visualization will give you a high-level view of the archives.");
	const searchForm = toolBar.append("form");
	const inputsFieldSet = searchForm.append("fieldset")
		.attr("class", "inputs");
	this.textSearch = inputsFieldSet.append("input")
		.attr("id", "agency-or-function-name-filter")
		.attr("placeholder", "Keywords")
		.attr("type", "text")
		.attr("size", "20")
		.property("value", searchPhrase);
	const wholeWordsFieldSet = inputsFieldSet.append("fieldset");
	const wholeWordsCheckbox = wholeWordsFieldSet.append("input")
		.attr("id", "whole-words")
		.attr("type", "checkbox")
		.attr("class", "default"); // defeat "JCF - JavaScript Custom Forms"
		// JCF would otherwise replace this select element with another one that may or may not work
		// JCF used on PROV's Drupal-based website.
		// NB similar problems are always possible on other sites.
	let wholeWordsLabel = wholeWordsFieldSet.append("label")
		.attr("for", "whole-words")
		.text("Whole words");
	if (wholeWords == "words") {
		wholeWordsCheckbox.attr("checked", "checked");
	}
	this.functionList = inputsFieldSet.append("select")
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
				this.textSearch.property("value", this.functionList.property("value"));
				this.functionList.property("value", "... or select a function");
				this.performSearch();
			}.bind(this)
		);
	let yearSearch = inputsFieldSet.append("input")
		.attr("id", "year-filter")
		.attr("type", "text")
		.attr("size", "4")
		.attr("placeholder", "Year")
		.attr("maxlength", "4")
		.property("value", searchYear);

	let buttonFieldSet = searchForm.append("fieldset")
		.attr("class", "buttons");
	
	let submitButton = buttonFieldSet.append("input")
		.attr("id", "submit")
		.attr("type", "submit")
		.property("value", "Search");
		
	searchForm
		.on(
			"submit", 
			function(d, i) {
				// this event is now handled
				d3.event.preventDefault();
				this.performSearch();
			}.bind(this)
		);
	
	this.hideLabelsButton = buttonFieldSet.append("input")
		.attr("id", "hide-labels")
		.attr("type", "submit")
		.attr("disabled", "disabled")
		.property("value", "Hide Labels");
	
	this.hideLabelsButton.on(
		"click",
		function(d, i) {
			// this event is now handled
			d3.event.preventDefault();
			this.nodeLabels.classed("selected", false);
			this.hideLabelsButton.attr("disabled", "disabled");
		}.bind(this)
	);
	
	let showHelpButton = buttonFieldSet.append("input")
		.attr("id", "show-help")
		.attr("type", "submit")
		.property("value", "Show Help");
		
	showHelpButton.on(
		"click",
		function(d, i) {
			// event handled; no further processing needed
			d3.event.preventDefault();
			this.showHelp();
		}.bind(this)
	);
	
	const zoomToFitButton = buttonFieldSet.append("input")
		.attr("id", "zoom-to-fit")
		.attr("type", "submit")
		.property("value", "Zoom to fit");
		
	zoomToFitButton.on(
		"click",
		function(d, i) {
			d3.event.preventDefault();
			this.resetManualZoom();
		}.bind(this)
	);

	this.updateUri();
	return searchForm;
}


matchesDateFilter(period) {
	var yearFilterText = this.provisualizer.select('#year-filter').property("value");
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

populateFunctionDropDownList() {
	const functionList = this.provisualizer.select("#function-list");
	functionList.append("option")
		.text("... or select a function");
	for(const functionName in this.uniqueFunctionNames) 
		functionList.append("option")
			.text(functionName);
}

performSearch() {
	this.createFilteredGraphFromLinks();
	this.updateUri();
	this.resetManualZoom();
}

updateUri() {
	window.location.hash = "#" + this.getSearchFragment();
}	

getSearchFragment() {
	// the URI fragment contains the search phrase, and if specified, a year, and whether "whole words" is checked
	// each part delimited by an underscore
	const textSearch = this.provisualizer.select("#agency-or-function-name-filter").property("value");
	const yearSearch = this.provisualizer.select("#year-filter").property("value");
	const wholeWords = this.provisualizer.select("#whole-words").property("checked");
	if (yearSearch == "" && !wholeWords) {
		 return encodeURIComponent(textSearch);
	} else {
		return encodeURIComponent(textSearch + "_" + yearSearch + "_" + (wholeWords ? "words" : ""));
	}
}
	

	
	// zoom and pan
	zoom() {
		//console.log("translate: ", d3.event.translate, ", scale: ", d3.event.scale);
		this.svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		// once the user has zoomed manually, they should be able to use the 'Zoom to fit" button 
		// reset the zoom (so that it displays the entire visualization).
		this.provisualizer.select("#zoom-to-fit").attr("disabled", null);
   	}
   	
   	resetManualZoom() {
		this.zoomBehavior.translate([0, 0]);
		this.zoomBehavior.scale(1);
		this.zoomBehavior.event(this.svg);	
		// once the manual zoom is reset (and hence will be showing the entire visualization)
		// the "zoom to fit" button does not apply until the user manually zooms again
		this.provisualizer.select("#zoom-to-fit").attr("disabled", "disabled");
   	}
	
   	zoomToFit() {
   		const bbox = this.svg.node().getBBox();
   		//var toolbarHeight = toolBar.node().clientHeight;
		// TODO don't just set the parent SVG's bounding box = to the bbox;
		// it should instead be set to a box which tightly encloses the
		// inner <g> element
   		const svgHeight = this.svg.node().getBoundingClientRect().height;
   		const viewBox = this.outerSvg.attr("viewBox");
		if (viewBox == null) {
			this.outerSvg.attr(
				"viewBox", 
				bbox.x + " " + 
				bbox.y + " " + 
				bbox.width + " " + 
				bbox.height
			);
		} else {
			var viewBoxValues = viewBox.split(" ");
			var viewBoxX = parseFloat(viewBoxValues[0]);
			var viewBoxY = parseFloat(viewBoxValues[1]);
			var viewBoxWidth = parseFloat(viewBoxValues[2]);
			var viewBoxHeight = parseFloat(viewBoxValues[3]);
			// "smoothing" is weighting given to the status quo viewbox when combining it 
			// with a desired new viewbox. This keeps the viewbox relatively stable
			// without jittering about due to small sub-graphs flying about in cometary orbits.
   			const smoothing = 3; 
   			const newY = (bbox.y + smoothing * viewBoxY) / (smoothing + 1) ;
   			const newHeight = (bbox.height + smoothing * viewBoxHeight) / (smoothing + 1) ;
			this.outerSvg.attr(
				"viewBox", 
				(bbox.x + smoothing * viewBoxX) / (smoothing + 1) + " " + 
				newY + " " + 
				(bbox.width + smoothing * viewBoxWidth) / (smoothing + 1) + " " + 
				newHeight
			);
		}
   	}

   	mouseover(node, index) {
   		// labels don't need box; just a label by itself
   		const labels = this.nodeLabels
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
   			this.hideLabelsButton.attr("disabled", null);
   		//}
   		
   		const connectedLines = this.svg.selectAll(".link")
   			.filter(
   				function(d) {
   					return d.source == node || d.target == node;
   				}
   			);
   		connectedLines.classed("highlighted", true);
   	}
   	
   	mouseout(node, index) {
   		// labels don't need box; just a label by itself
   		//popup.style("display", "none");
   		//d3.select(this).style("display", "none"); 
   		// disabled hiding of labels, once shown they remain visible, see 
   		// <https://github.com/Conal-Tuohy/Provisualizer/issues/11#issuecomment-184508962>
   		// var labels = nodeLabels.classed("selected", false);
   		const connectedLines = this.svg.selectAll(".link").classed("highlighted", false);
   		const labels = this.nodeLabels
   			.filter(
   				function(d) {
   					return d == node;
   				}
   			)
   			.each(
   				function(label) {
   					label.fadeTime = Date.now() + this.labelFadeDelay;
   				}
   			);
   	}
}

customElements.define("provisualizer-widget", PROVisualizer);
