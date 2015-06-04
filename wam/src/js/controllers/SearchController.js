/**
 * 
 */

//var reverseProxyUrl = "http://localhost:8080/kalmec/proxy";
var reverseProxyUrl = "http://collab.ca-devtu-zsdb0.credit-agricole.fr/emresultsearch/emresultsearch/1.0/rest/emresultsearch/recherchesimplecomplete?timeStamp=" + new Date().getTime();

var app = angular.module('hub');

app.controller("searchController", ['$rootScope', '$window', '$scope', '$http', '$location', '$cookieStore', function($rootScope, $window, $scope, $http, $location, $cookieStore) {
	
	/**
	 * convert a DTO to a readable object by our sample
	 * 
	 * @param {object} dto the dto to convert
	 * @return {object} a readable item
	 */
	function convertDTO(dto) {
		var item = {
				'email' : dto.adrCourriel,
				'address': dto.adrPostale,
				'fullname': dto.civi + " " + dto.nomPatronymique + " " + dto.prenom,
				'firstname' : dto.prenom,
				'lastname' : dto.nomPatronymique,
				'contractNumber' : dto.numContrat,
				'birthdate' : dto.dateNaissance
		};
		
		return item;
	}
	
	var searchData = {
			"data":
			{
				"saisie": "sem",
				"categorie":"",
				"support":"PC",
				"skipFrom":"0",
				"skipCount":"25"
			}
	},
	filledExecutionContext = {
			"systemInfo" : {
				"uid" : "C447E9CC8-8C52-42CE-B2AB-A2878A6F6B57",
				"id" : "C447E9CC8-8C52-42CE-B2AB-A2878A6F6B57",
				"operationalPost" : {
					"uid" : "C91C7E329-8E3F-498C-A99E-E957F07CFDB0",
					"id" : "87800QAZSD0015401   ",
					"label" : "PC",
					"type" : "1",
					"mediaType" : "",
					"deviceType" : "",
					"ip" : "10.156.0.132",
					"hostname" : "QAZSD0015401",
					"printerPeripherals" : []
				},
				"eds" : {
					"id" : "878000015407",
					"label" : "GIVORS CENTRE                   "
				},
				"financialTransactionDate" : "2014-07-10T09:08:50.900Z"
			},
			"sessionMode" : {
				"uid" : "CB7D081A6-7DDD-4A09-B5CD-5EAAFC01DFCE",
				"id" : "CB7D081A6-7DDD-4A09-B5CD-5EAAFC01DFCE",
				"idSessionPortail" : "F4AF1C51-9DA2-436A-AC22-47FFE983E463",
				"canal" : "12",
				"distribCanal" : "BP",
				"transport" : "INTRA",
				"usage" : "COL"
			},
			"profile" : {
				"uid" : "C152F6B15-4765-4993-9591-389DCC17AC31",
				"id" : "C152F6B15-4765-4993-9591-389DCC17AC31",
				"functionalPost" : {
					"id" : "878003PK9",
					"label" : "CO.CLI.PART CRAPONNE            ",
					"functionId" : "310",
					"functionLabel" : "CONSEILLER CLIENTELE            ",
					"edsId" : "878000034606"
				},
				"user" : {
					"uid" : "C9C2BBFA6-B3ED-4CF0-AA18-A4C7C9D6AE04",
					"id" : "8780060001  ",
					"code" : "OX60001",
					"type" : "01",
					"lastName" : "USER DEVTU                      ",
					"firstName" : "AGENCE                          "
				},
				"customerRole" : {
					"uid" : "CEBDB8F31-FDCB-4618-BF7E-54931A2E9ED1",
					"id" : "CEBDB8F31-FDCB-4618-BF7E-54931A2E9ED1",
					"markets" : [],
					"segments" : []
				},
				"structureId" : "87800",
				"bankNetwork" : "BP",
				"camEntity" : "87800",
				"inversedCAMEntity" : "00878"
			}
		};
	
	$scope.searchFilter = '';
	
	$scope.results = [];
	
	$scope.nbResults = 0;
	
	$scope.fetchResuts = function() {
		console.log("Fetching results");
		
		var url='http://collab.ca-devtu-zsdb0.credit-agricole.fr/emresultsearch/emresultsearch/1.0/rest/emresultsearch/recherchesimplecomplete?timeStamp=1405950119494',
			params = searchData, //$.extend(searchData, {_url: url}),
			serialize = function(data) {
				var ser = "";
				angular.forEach(data, function(value, key) {
					if(typeof value == "function" || !data.hasOwnProperty(key)) {
						return;
					}
					if(ser !== "") {
						ser += "&";
					}
					ser += key + "=" + value;
				});
				return ser;
			},
			promise = null;
		
		promise = $http.post(reverseProxyUrl + "?_url=" + url + "&contextExecution=" + JSON.stringify(filledExecutionContext), searchData);
		promise.success(function(data, status, headers, config) {
			
			if(null == data || null == data.data || null == data.data.onglets) {
				console.log("no results");
				return;
			}
			
			var tabs = data.data.onglets;
			
			$scope.nbResults = tabs.nombreResultats;
			angular.forEach(tabs, function(tab, tabIndex) {
				if(tab.hasOwnProperty('sousOnglets')) {
					angular.forEach(tab.sousOnglets, function(tabContent, key) {
						var searchResults = tabContent.resultats;
						if(null == searchResults || typeof searchResults != "object") {
							// means no results
							return;
						}
						// parse results and push contact into search results.
						angular.forEach(searchResults, function(resultItem, resultItemIndex) {
							$scope.results.push(convertDTO(resultItem));
						});
					}); 
				}
			});
		});
		
		promise.error(function(data, status, headers, config) {
			console.error(arguments);
		});
	};
	
	$scope.init = function() {
		//$cookieStore.remove("PD-H-SESSION-ID");
		$scope.fetchResuts();
	};
	
	$scope.init();
}]);
