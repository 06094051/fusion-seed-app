'use strict';

angular.module('fusionSeed.viewSearch', ['ngRoute','solr.Directives'])



.constant("SEARCH_DEFAULTS", {
	"proxy_url": "http://localhost:9292/",
	"fusion_url": "localhost:8764",
	"pipeline_id": "products-demo",
	"collection_id": "products",
	"request_handler": "select",
	"taxonomy_field": "cpath",
	"filter_separator": "~",
    "taxonomy_separator": "/",
	"controller_path": "search",
	"multi_select_facets": false,
	"collapse_field": "name_exact_s"
})
.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
  	when('/search', {
    	templateUrl: 'view-search/view-search.html',
    	controller: 'ViewSearchCtrl'
  	}).
  	when('/search/:category/:filter', {
    	templateUrl: 'view-search/view-search.html',
    	controller: 'ViewSearchCtrl'
  	}).
  	when('/search/:category', {
    	templateUrl: 'view-search/view-search.html',
    	controller: 'ViewSearchCtrl'
  	});
}])

/*.controller('ViewSearchCtrl', [function() {

}]);*/

.controller('ViewSearchCtrl', function (SEARCH_DEFAULTS, $scope, $http, $routeParams, $location, $route, $sce) {

	var proxy_base = SEARCH_DEFAULTS.proxy_url; 
	var fusion_url = SEARCH_DEFAULTS.fusion_url

	var pipeline_id = SEARCH_DEFAULTS.pipeline_id;
	var collection_id = SEARCH_DEFAULTS.collection_id;

	//override default if passed to URL
	if ($routeParams.collection_id) collection_id = $routeParams.collection_id;
	if ($routeParams.pipeline_id) pipeline_id = $routeParams.pipeline_id;

	var request_handler = SEARCH_DEFAULTS.request_handler;
	var url = proxy_base+fusion_url+'/api/apollo/query-pipelines/'+pipeline_id+'/collections/'+collection_id+'/'+request_handler;
	//var url = "http://localhost:9292/ec2-54-160-96-32.compute-1.amazonaws.com:8764/api/apollo/query-pipelines/test1-default/collections/test1/select?json.nl=arrarr&q=*:*&rows=100&wt=json"
	//var url = "http://ec2-54-160-96-32.compute-1.amazonaws.com:8983/solr/test1/select?q=*:*";

	var filter_separator = SEARCH_DEFAULTS.filter_separator;
	var multi_select_facets = SEARCH_DEFAULTS.multi_select_facets;
	var cat_facet_field = SEARCH_DEFAULTS.taxonomy_field;
	var collapse = "{!collapse field="+SEARCH_DEFAULTS.collapse_field+"}";

    $scope.controller_path = SEARCH_DEFAULTS.controller_path;
    $scope.taxonomy_field = SEARCH_DEFAULTS.taxonomy_field;
    $scope.taxonomy_separator = SEARCH_DEFAULTS.taxonomy_separator;
	$scope.filter_separator = filter_separator;
	$scope.multi_select_facets = multi_select_facets;
	$scope.$route = $route;
	$scope.$location = $location;
	$scope.$routeParams = $routeParams;

	$scope.isCatFilterOpen = false;
	$scope.isFacetFilterOpen = true;

	var q = '*:*';
	if ($routeParams.q) q = $routeParams.q;
	console.log('q = '+$routeParams.q);
	
	var category = '*';
	if ($routeParams.category) category = decodePath($routeParams.category);
	console.log('category =' + category);

	//use lucene term qparser unless it is a * query
	var cpath_fq;
	cpath_fq = "*:*"; //temp until we have a proper category facet
	if (category == '*')
	 	cpath_fq = cat_facet_field+':'+category; //'cpath:'+category;
	else
	 	cpath_fq = '{!term f='+cat_facet_field+'}'+category;


	//var filter = $routeParams.filter;
    var filter = $routeParams.f;
	//parse filter queries into an array so they can be passed.
	var fqs = [];
	if (filter) fqs = filter;

	//if we're using multi_select_facets, change the syntax of the fqs
	if (multi_select_facets) {
		var new_fqs = [];
		for (var i=0;i<fqs.length;i++) {
			//console.logs('old fq:' + fqs[i]);
			//&fq={!tag=colortag}color:red
			var fname = fqs[i].split(':')[0];
			var new_fq = '{!tag='+fname+'_tag}'+fqs[i];
			//console.logs('new fq:' + new_fq);
			new_fqs.push(new_fq);
		}
		fqs = new_fqs;
	}
	//convert all fqs to {!term} qparser syntax
	var new_fqs = []
	for (var i=0;i<fqs.length;i++) {
		var kv = fqs[i].split(':');
		var fname = kv[0];
		var fvalue = kv[1];
		new_fq = '{!term f='+fname+'}'+fvalue;
		new_fqs.push(new_fq);		
	}
	fqs = new_fqs;

	//add category as a filter
	fqs.push(cpath_fq);
	//field collapsing
	//fqs.push('{!collapse field='+group_field+'}');
	if (collapse) {
		fqs.push(collapse);
	}

	//To use JSONP and avoid using a proxy, change method to JSONP, and add 'json.wrf': 'JSON_CALLBACK' to the params.
 	$http.defaults.headers.common['Authorization'] = 'Basic ' + btoa('admin:password123');
	$http(
		{method: 'GET',
		 url: url,
		 params:{
		 		'q': q,
		 		'fq': fqs,
		 		'wt': 'json',
		 		'rows' : 10,
		 		'json.nl': 'arrarr'
		 		}
		})
		.success(function(data, status, headers, config) {

          $scope.data = data;
          $scope.showData = false;
          $scope.showDoc = false;


		  var solr_params = data.responseHeader.params;
		  
		  //using groups, pass groups instead of docs
		  //var grouped_field = data.grouped[group_field];
		  //console.logs(groups);

		  var facet_fields = data.facet_counts.facet_fields;
		  var facet_queries = data.facet_counts.facet_queries;
		  var taxonomy = facet_fields[cat_facet_field];

		  //console.logs('solr_params:'+JSON.stringify(solr_params));

		  $scope.solr_params = solr_params;
		  $scope.showParams = false;
		  //$scope.split_solr_params = solr_params.split(',');

		  //$scope.docs = docs;
		  //$scope.grouped_field = grouped_field;
		  $scope.facet_fields = facet_fields;
		  $scope.facet_queries = facet_queries;
		  $scope.taxonomy = taxonomy;

		  //FIELD COLLAPSING DISPLAY
		  var docs = data.response.docs;
		  $scope.docs = docs;
		  //console.logs('grouped:'+JSON.stringify(data.grouped));

		  //console.logs('expanded:' + JSON.stringify(data.expanded));
		  // /FIELD COLLAPSING


		}).error(function(data, status, headers, config) {
		  console.log('Search failed!');
		  console.log(headers);
		  console.log(data);
		  console.log(config);
            });
	
	/*$scope.parseCategory = function(path, str_indent) {
		var arr_path = path.split('/');
		var length = arr_path.length;
		var catName = arr_path[length-1];
		var indent = '';

		//catName += '<a href="#/c/'+path+'">'+catName+'</a>';

		for (var i = 0; i <length; i++) indent += str_indent;
		return [indent,catName];
		//return path;
	};*/

	$scope.encodePath =  function(path) { return encodePath(path) };
	$scope.parseFacetLabel = function(field) {
        field = field.replace('_ss', '');
        field = field.replace('_s','');
        field = field.replace('_', ' ');
        return field.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };


	$scope.clickSearch = function(query) {
		$location.search('q', query);
	}


    $scope.createCatLink = function(cat) {

        var q = "";
        if ($routeParams.q) q = $routeParams.q;
        return "#/"+SEARCH_DEFAULTS.controller_path+"/"+encodePath(cat)+"?q="+q;
    }


	$scope.clickFacet = function(fname, fvalue) {


        var search = $location.search();

        //was the filter already clicked on?
        var filters = search['f'];
        var already_clicked = false;
        if (filters) {
            if (Array.isArray(filters)) {
                for (var i=0;i<filters.length;i++) {
                    if (filters[i] == fname+":"+fvalue) {
                        //console.log("ALREADY CLICKED (multi filter)");
                        already_clicked = true;
                        filters.splice(i,1);
                        search['f'] = filters;
                    }
                }
            } else {
                if (filters == fname+":"+fvalue) {
                    //console.log ("ALREADY CLICKED (single filter)");
                    already_clicked = true;
                    //console.log("search f before: "+ search['f'])
                    delete search['f'];
                    //console.log("search f after: "+ search['f'])
                }
            }
        }

        if (already_clicked == false) {
            var f = []; //array of filters
            if (search['f']) {
                //if there is already multiple "f"s then it is already array
                if (Array.isArray(search['f'])) f = search['f']
                //if there is a single value (not an array), add it to our array
                else f.push(search['f']);
            }
            //add the new filter to our array
            f.push(fname + ":" + fvalue);
            //add our new array of filters to the search object
            search['f'] = f;
        }
        $location.search(search);
        $location.replace();


		/*console.log('clicked on ' + fname + ':' + fvalue);
		if (routeParams.filter) {
			if (routeParams.filter.indexOf(fname+":"+fvalue) > -1) {
				console.log("FACET ALREADY CLICKED!");
				//remove the fname:fvalue from the filter
				var newf = splitFilter(routeParams.filter, filter_separator);
				var arr_filter = []
				for (var i=0;i<newf.length;i++) {
					if (fname+":"+fvalue == newf[i]) {
						console.log("FACET UNSELECT:" + newf[i]); //don't add it
					} else {
						console.log("FACET SELECTION:" + newf[i]);
						arr_filter.push(newf[i]);
					}
				}
				console.log('NEW FILTER STRING:' + filterConcat(arr_filter,filter_separator));
				routeParams.filter = filterConcat(arr_filter,filter_separator);
			} else {
				routeParams.filter+=filter_separator+fname+':'+fvalue;
			}
		} else routeParams.filter = fname+":"+fvalue;


		//$location.path('test');


		var new_url = '/search/'+routeParams.category+'/'+routeParams.filter;
		if (routeParams.q) new_url+= '?q='+routeParams.q;
		$location.url(new_url);*/

	}

	function splitFilter(filter, filter_separator) {
		return filter.split(filter_separator);
	}

	function filterConcat(arr_filter, filter_separator) {
		var filter = '';
		for (var i=0;i<arr_filter.length;i++) {
			filter+= arr_filter[i];
			if (i != arr_filter.length-1) {
				filter += filter_separator;
			}
		}
		return filter;
	}

	/*$scope.isSelected = function(fname, fvalue, routeParams) {
		if (routeParams.filter) {
			if (routeParams.filter.indexOf(fname+':'+fvalue) > -1) return true;
			else return false;
		}
		return false;
	}*/
    $scope.isSelected = function(fname, fvalue) {

            var search = $location.search();
            if (search.f) {
                if (search.f.indexOf(fname+':'+fvalue) > -1) return true;
                else return false;
            }
            return false;
        }

	$scope.renderHtml = function(html_code)
	{
	    return $sce.trustAsHtml(html_code);
	};


	function encodePath(path) {
		return path.
			replace(/\//g, '~').
			replace(/ /g, '-');
	}

	function decodePath(path) {
		return path.
			replace(/~/g, '/').
			replace(/-/g, ' ');
	};


});
