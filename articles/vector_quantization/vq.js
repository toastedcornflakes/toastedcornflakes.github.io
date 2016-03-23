(function my_top_level_function() {
	"use strict";

	const MAX_NUMBER_OF_NODES = 100000;
	// Don't get it lower than 2 otherwise the logic for comparing distance needs to be rewritten
	const MIN_NUMBER_OF_NODES = 2; 
	const MIN_NUMBER_CENTROIDS = 2;

	/*
	   const MIN_STEP_TIME = 10;
	   const MAX_STEP_TIME = 5000;
	   const DEFAULT_STEP_TIME = 100; 
	   */

	const DEFAULT_NUMBER_OF_NODES = 60;
	const DEFAULT_NUMBER_OF_CENTROIDS = 5;

	const DRAWING_MARGIN_FACTOR = 0.03;

	// replace Math.random with something reproducible
	const REPRODUCIBLE_RNG = false;

	// matches the HTML select string
	const ALGORITHMS = {
		"lloyds": 1,
		"gradient": 2,
		"stochastic_gradient" : 3
	};

	// matches the HTML select string
	const DISTANCES = {
		"euclidean": function euclidean_distance(a, b) {
			return Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2);
		},
		"manhattan": function manhattan_distance(a, b) {
			return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
		}
	};



	/*
	 * MainLoop is in charge of a canvas and related HTML input elements for parameters selection
	 * It advances the simulation and paints it in the canvas 
	 */
	function MainLoop(canvas_id, options) {
		this.canvas = document.getElementById(canvas_id);
		if(!this.canvas) {
			throw "Invalid canvas";
		}

		// setup the options and the defaults
		this.options = options || {};
		if(!this.options.nodes) this.options.nodes = DEFAULT_NUMBER_OF_NODES;
		if(!this.options.centroids) this.options.centroids = DEFAULT_NUMBER_OF_CENTROIDS;
		if(!this.options.algorithm) this.options.algorithm = ALGORITHMS.stochastic_gradient;
		if(!this.options.distance) this.options.distance = DISTANCES.euclidean;

		// creates the nodes and centroids
		// and set some variables used by the algorithms
		// and the DOM handling 
		this.reset();

		if (REPRODUCIBLE_RNG) {	
			var seed = 1;
			Math.random = function random() {
				var x = Math.sin(seed++) * 10000;
				return x - Math.floor(x);
			};
		}

		this.draw();
	}

	MainLoop.prototype.reset = function reset() {
		this.start_aspect_ratio = this.canvas.width / this.canvas.height;
		this.make_nodes();
		this.make_initial_centroids();
		this.should_reset = false;
		this.steady_state_reached = false;
		this.iterations = 0;
	};

	MainLoop.prototype.run = function run() {
		if(this.should_reset) {
			this.reset();
		}

		this.iterations++;

		// draw nodes and centroids
		this.draw();
		if(!this.steady_state_reached) {
			// compute distances between each node and each centroid
			// and update which centroid correspond to which node
			this.update_mappings();
			this.update_centroids();
		}

		// schedule itself to run again in some time
		// (need to use the = this trick to set `this` when the event fires 
		var loop = this;
		function call_this_run() {
			loop.run.call(loop);
		}
		window.setTimeout(call_this_run, 300);
	};

	MainLoop.prototype.update = function() {
		this.should_reset = true;	
	};


	// and an index of its centroid, which is a special node 
	function Node(x, y, centroid)  {
		this.x = x;
		this.y = y;
		this.centroid = centroid;
	}

	function scale_x(x, width, aspect_ratio) {
		if(!aspect_ratio) throw "yolo";
		var offset = width * DRAWING_MARGIN_FACTOR;
		return (x / aspect_ratio) * (width - 2 * offset) + offset; 
	}

	function scale_y(x, width) {
		var offset = width * DRAWING_MARGIN_FACTOR;
		return x * (width - 2 * offset) + offset; 
	}

	// A node can draw itself as a circle in a canvas
	// and a line to its centroid if it's defined
	Node.prototype.draw = function node_draw(canvas, radius, aspect_ratio) {
		var x = scale_x(this.x, canvas.width, aspect_ratio);
		var y = scale_y(this.y, canvas.height);

		if (this.centroid) {
			draw_circle(canvas, x, y, radius, this.centroid.color);	
		} else {
			draw_circle(canvas, x, y, radius, "#000000");	
		}
	};

	Centroid.prototype.draw_lines = function centroid_draw_lines(canvas, aspect_ratio) {
		var ctx = canvas.getContext("2d");
		ctx.beginPath();
		for (var i = 0; i < this.nodes.length; i++)  {
			var node = this.nodes[i];
			var x_node = scale_x(node.x, canvas.width, aspect_ratio);
			var y_node = scale_y(node.y, canvas.height);
			var x_centroid = scale_x(this.x, canvas.width, aspect_ratio);
			var y_centroid = scale_y(this.y, canvas.height);

			// draw the line between the node and its centroid
			ctx.moveTo(x_node, y_node);
			ctx.lineTo(x_centroid, y_centroid);
		}
		ctx.fillStyle = "#000000";
		ctx.stroke();
	};

	Centroid.prototype.draw = function centroid_draw(canvas, radius, aspect_ratio) {
		var x = scale_x(this.x, canvas.width, aspect_ratio);
		var y = scale_y(this.y, canvas.height);

		draw_circle(canvas, x, y, radius, this.color);
		draw_circle(canvas, x, y, radius * 0.5, "#ffffff");
	};

	function Centroid(x, y, color, nodes) {
		this.x = x;
		this.y = y;
		this.color = color;
		if (nodes)
			this.nodes = nodes;
		else
			this.nodes = [];
	}

	Centroid.prototype.reset_nodes = function reset_nodes() {
		this.nodes = [];
	};

	MainLoop.prototype.make_nodes = function make_nodes() {
		var n = this.options.nodes;
		var nodes = new Array(n);
		for(var i = 0; i < n; i++) {
			var node = new Node(Math.random() * this.start_aspect_ratio, Math.random(), undefined);
			nodes[i] = node;	
		}
		this.nodes = nodes;
	};

	MainLoop.prototype.make_initial_centroids = function make_initial_centroids() {
		if (this.options.centroids > this.nodes.length) {
			throw "Too much centroids";
		}

		var centroids = new Array(this.options.centroids);
		for(var i = 0; i < this.options.centroids; i++) {
			var pad = "000000";
			var random_n = Math.floor(Math.random()*16777215).toString(16);
			// avoid the truncation of the color
			random_n = pad.substring(0, (6 - random_n.length))  + random_n;
			var random_color = '#' + random_n;

			// simple strategy: use the first nodes to initialize
			// the centroids position
			centroids[i] = new Centroid(this.nodes[i].x, this.nodes[i].y, random_color);
		} 
		this.centroids = centroids;
	};

	function draw_circle(canvas, x_position, y_position, radius, color) {
		var c = canvas.getContext("2d");
		c.beginPath();
		c.arc(x_position, y_position, radius, 0, 2*Math.PI, true);
		c.fillStyle = color;
		c.fill();
	}

	// draws the centroids and nodes in the canvas
	MainLoop.prototype.draw = function draw_all() {
		var canvas = this.canvas;
		var nodes = this.nodes;
		var centroids = this.centroids;

		var ctx = canvas.getContext("2d");

		// TODO BETTER THIS
		canvas.style.width='100%';
		canvas.style.height='100%';
		canvas.width  = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// heuristic radius definition to draw something appealing
		var radius = canvas.width * canvas.height / (10000 * Math.sqrt(nodes.length));
		for (var i = 0; i < centroids.length; i++) {
			centroids[i].draw_lines(canvas, this.start_aspect_ratio);
		}
		for (i = 0; i < nodes.length; i++) {
			nodes[i].draw(canvas, radius, this.start_aspect_ratio);
		}

		// centroids are bigger (draw them after because we want to see them
		// on the top of normal nodes)
		for (i = 0; i < centroids.length; i++) {
			centroids[i].draw(canvas, radius * 1.5, this.start_aspect_ratio);
		}

		ctx.fillStyle = "#888";
		ctx.textAlign = "end";
		ctx.font = "1.2em sans-serif";
		ctx.fillText("Iteration #" + this.iterations, canvas.width - 40, canvas.height - 20);
	};

	// runs through the nodes and maps the closest centroid to it
	// if no mapping changes, this.steady state is set to true
	MainLoop.prototype.update_mappings = function update_mappings() {
		// sets every centroid.nodes to a new list
		// and update each node.centroid

		this.steady_state_reached = true;
		for (var i = 0; i < this.centroids.length; i++) {
			this.centroids[i].reset_nodes();
		}
		for (i = 0; i < this.nodes.length; i++) {
			var node = this.nodes[i];
			var closest_centroid = this.centroids[0];
			for (var j = 0; j < this.centroids.length; j++) {
				if (this.options.distance(node, this.centroids[j]) < this.options.distance(node, closest_centroid)) {
					closest_centroid = this.centroids[j];
				}
			}
			if (node.centroid !== closest_centroid) {
				this.steady_state_reached = false;
				node.centroid = closest_centroid;
			}
			closest_centroid.nodes.push(node);
		}
	};

	// selects the correct algorithm
	MainLoop.prototype.update_centroids = function update_centroids() {
		if (this.options.algorithm === ALGORITHMS.lloyds) {
			this.update_centroids_lloyds();	
		} else if (this.options.algorithm === ALGORITHMS.stochastic_gradient) {
			this.steady_state_reached = false;
			this.update_centroids_stochastic_gradient();
		} else {
			throw "Not implemented";
		}
	};

	// runs the lloyds algorithm
	MainLoop.prototype.update_centroids_lloyds = function update_centroids_lloyds() {
		var nodes = this.nodes;
		var centroids = this.centroids; 

		// Assign the new centroid coordinates as the center of mass
		for (var i = 0; i < centroids.length; i++) {
			var total_x = 0;
			var total_y = 0;
			var node_for_centroid = 0;
			for (var j = 0; j < nodes.length; j++) {
				if(nodes[j].centroid === centroids[i]) {
					total_x += nodes[j].x;
					total_y += nodes[j].y;
					node_for_centroid++;
				}
			}

			if (node_for_centroid === 0) {
				console.log("Orphan centroid");
			} else {
				centroids[i].x = total_x / node_for_centroid;
				centroids[i].y = total_y / node_for_centroid;
			}
		}
	};

	function quantization_rate(iterations) {
		return 1 / (iterations  + 1);
	}

	// move one of the centroids in the direction of one of its node
	MainLoop.prototype.update_centroids_stochastic_gradient = function update_centroids_gradient() {
		var alpha = 5 * Math.sqrt(this.options.nodes / this.options.centroids) * quantization_rate(this.iterations);
		/*
		   for (var i = 0; i < this.centroids.length; i++) {
		   var centroid = this.centroids[i];
		// take a random node of this centroid, if it isn't orphan
		var node = centroid.nodes[Math.floor(centroid.nodes.length * Math.random())];
		if (!node) continue;

		centroid.x += alpha * (node.x - centroid.x);
		centroid.y += alpha * (node.y - centroid.y);
		}
		*/
		// experiment: move only one centroid
		var centroid = this.centroids[Math.floor(this.centroids.length * Math.random())];
		var node = centroid.nodes[Math.floor(centroid.nodes.length * Math.random())];
		if (!node) return;
		centroid.x += alpha * (node.x - centroid.x);
		centroid.y += alpha * (node.y - centroid.y);

		// sanity check 
		if(centroid.x > this.start_aspect_ratio) centroid.x = this.start_aspect_ratio;
		if(centroid.x < 0.0) centroid.x = 0.0;
		if(centroid.y > 1.0) centroid.y = 1.0;
		if(centroid.y < 0.0) centroid.y = 0.0;

	};

	// sets default values and events callbacks
	// then starts the main loop
	(function setup_dom() {
		var n_selector = document.getElementById("nodes_count");
		n_selector.value = DEFAULT_NUMBER_OF_NODES;
		var classes_count_selector = document.getElementById("classes_count");
		classes_count_selector.value = DEFAULT_NUMBER_OF_CENTROIDS;

		var algorithm_selector = document.getElementById("algorithm_selector");
		var distance_selector = document.getElementById("distance_selector");

		var restart_button = document.getElementById("restart_button");

		// Get new input from the DOM
		function parse_dom_params(loop) {
			var new_n = parseInt(n_selector.value, 10);
			if (isNaN(new_n)) {
				new_n = 10;
			} else if (new_n < MIN_NUMBER_OF_NODES) {
				new_n = MIN_NUMBER_OF_NODES;
			} else if (new_n > MAX_NUMBER_OF_NODES ) {
				new_n = MAX_NUMBER_OF_NODES;
			}

			var new_classes_count = parseInt(classes_count_selector.value, 10);
			new_classes_count = Math.ceil(new_classes_count);
			if (isNaN(new_classes_count) || new_classes_count < MIN_NUMBER_CENTROIDS) { 
				new_classes_count = MIN_NUMBER_CENTROIDS;
			} else if (new_classes_count > new_n) {
				new_classes_count = new_n;
			}

			var new_algorithm = ALGORITHMS[algorithm_selector.value]; 
			var new_distance = DISTANCES[distance_selector.value]; 

			loop.options.centroids = new_classes_count;
			loop.options.nodes = new_n;
			loop.options.algorithm = new_algorithm;
			loop.options.distance = new_distance;
		}

		// start the machinery
		var loop = new MainLoop("maincanvas");

		function update_options_from_dom_then_loop() {
			parse_dom_params(loop);
			loop.update.call(loop);
		}

		classes_count_selector.addEventListener("input", update_options_from_dom_then_loop);
		n_selector.addEventListener("input", update_options_from_dom_then_loop);
		algorithm_selector.addEventListener("change", update_options_from_dom_then_loop); 
		distance_selector.addEventListener("change", update_options_from_dom_then_loop); 
		restart_button.addEventListener("click", update_options_from_dom_then_loop);

		loop.run();
	})();
})();
