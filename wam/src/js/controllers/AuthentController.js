/**
 * 
 */

//var reverseProxyUrl = "http://localhost:8080/kalmec/proxy";
var reverseProxyUrl = "http://auin.collab.ca-devtu-zudb0.credit-agricole.fr/webapp_eai/webapp_eai/1.0/ValidateLogin?timetstamp=" + new Date().getTime(),
	addUrl = false;

var app = angular.module('hub');
app.controller("authentController", ['$window', '$scope', '$http', '$location', function($window, $scope, $http, $location) {
	
	$http.defaults.headers.common.Accept = 'application/json';
	
	var urls = {
			ident: [
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/identauthent/identauthent/1.0/rest/identauthent/getCurrentUser',
				   params: [
				       'timestamp'
				   ]
			   },
			   {
				   url: 'http://auin.collab.ca-devtu-zudb0.credit-agricole.fr/webapp_eai/webapp_eai/1.0/ValidateLogin',
				   params: [
				       'callback',
				       'username',
				       'password',
				       'functionalpost',
				       'contextExecution'
				   ]
			   }
	        ],
			clientSynthesis: [
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/PerimeterManager/PerimeterManager/1.2/rest/perimetermanagerextension/getdata',
				   params: [
				       'timestamp'
		           ]
			   },
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/syntheseclientparticulier/syntheseclientparticulier/1.0/rest/syntheseclientparticulier/init',
				   params: [
				      'timestamp'
				   ]
			   },
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/syntheseclientparticulier/syntheseclientparticulier/1.0/rest/syntheseclientparticulier/recupDonnees',
				   params: [
				       'timestamp'
		           ]
			   },
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/syntheseclientparticulier/syntheseclientparticulier/1.0/rest/syntheseclientparticulier/recupDonnees',
				   params: [
				       'timestamp'
		           ]
			   },
			   {
				   url: 'http://collab.ca-devtu-zsdb0.credit-agricole.fr/syntheseclientparticulier/syntheseclientparticulier/1.0/rest/syntheseclientparticulier/recupDonnees',
				   params: [
				       'timestamp'
		           ]
			   }
            ]
	},
	/**
	 * Blank execution context send by the client during authentication process
	 * 
	 */
	blankExecutionContext = {
		"systemInfo" : {
			"uid" : "CBBB2259F-3D35-4150-BEB2-875E8F6CF11B",
			"id" : "CBBB2259F-3D35-4150-BEB2-875E8F6CF11B",
			"operationalPost" : {
				"uid" : "CEC55AE62-9E02-44F2-A975-0A06AB5F120A",
				"label" : "PC",
				"type" : "1",
				"mediaType" : "",
				"deviceType" : "",
				"ip" : "10.156.0.132",
				"hostname" : "QAZSD0015401",
				"printerPeripherals" : []
			},
			"eds" : {
				"uid" : "C60E42CCD-8039-4DA5-9743-843625E622D8",
				"id" : null,
				"label" : null
			},
			"financialTransactionDate" : "2014-07-10T09:12:58.673Z"
		},
		"sessionMode" : {
			"uid" : "C381F30CF-0161-4453-8446-3EE9DDF08493",
			"id" : "C381F30CF-0161-4453-8446-3EE9DDF08493",
			"idSessionPortail" : "4FF922E9-BF46-4358-8609-3FF44CA296B4",
			"canal" : "12",
			"distribCanal" : null,
			"transport" : "INTRA",
			"usage" : "COL"
		},
		"profile" : {
			"uid" : "CD020E4DD-5734-4F13-BD57-F1EE1A12DD64",
			"id" : "CD020E4DD-5734-4F13-BD57-F1EE1A12DD64",
			"functionalPost" : {
				"uid" : "CB7AFEAE8-40AF-449F-A8BE-AE2DBCBE6111",
				"id" : null,
				"label" : null,
				"functionId" : null,
				"edsId" : null,
				"functionLabel" : null
			},
			"user" : {
				"uid" : "C4B0D327B-834C-42B4-ACB9-C89923CDCC3F",
				"id" : null,
				"code" : null,
				"type" : null,
				"lastName" : null,
				"firstName" : null
			},
			"customerRole" : {
				"uid" : "C341772B8-35EF-4C86-ABCF-6D2632FA0FCE",
				"id" : "C341772B8-35EF-4C86-ABCF-6D2632FA0FCE",
				"markets" : [],
				"segments" : []
			},
			"structureId" : "87800",
			"bankNetwork" : null,
			"camEntity" : null,
			"inversedCAMEntity" : null
		}
	}, filledExecutionContext = {
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
	},
	getCurrentDate = function() {
		return new Date().getTime();
	},
	ident = function() {
		console.log("indetification is starting");
		var url = urls.ident[0].url,
			params = {
				timestamp: getCurrentDate()
			},
			promise = $http.post(url, params).success(function(data, status, headers, config) {
				console.log(data);
			}).error(function(data, status, headers, config) {
				console.error(data);
			});

	},
	/**
	 * Take care about authentication. The purpose of this method is to create a simple way to authenticate an user.
	 */
	authent = function() {
		console.log("authentication is starting");
		var username = $scope.username, //$("input[name=username]").val(), //"OX60001",
			password = $scope.password, //$("input[name=password]").val(), //"OX60001D",
			functionalPost = $scope.functionalPost, //$("#functionalPost").val(), // 878003PK7
			callback = function(data) {
				console.log("Handle a response from the backend ...");
				console.log(data);
			},
			serialize = function(data) {
				var ser = "";
				angular.forEach(data, function(value, key) {
					if(typeof value == "function" || !data.hasOwnProperty(key)) {
						return;
					}
					if(ser !== "") {
						ser += "&";
					}
					ser+= key + "=" + value;
				});
				return ser;
			},
			url = urls.ident[1].url,
			params = {
				callback: callback,
				username: username,
				password: password,
				functionalpost: functionalPost
			},
			promise = null;
			
		// add url information if necessary
		if(addUrl && false) {
			params = $.extends(params, {_url: url});
		}
		
		promise = $http.get(reverseProxyUrl + "&" + serialize(params) + "&contextExecution=" + JSON.stringify(filledExecutionContext));
		promise.success(function(data, status, headers, config) {
			$window.location.href="/kalmec/search.jsp";
		});
		promise.error(function(data, status, headers, config) {
			console.log('failure');
			console.log(data);
		});
	},
	authentProcess = {
			start: function() {
				//ident();
				authent();
			}
	};
	
	$scope.username = "OX60001";
	$scope.password = "OX60001D";
	$scope.functionalPost = "878003PK9";

	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		setTimeout(function() {
			$("button[type=submit]").on('click', function() {
				authentProcess.start();
				//$location.path("/index.jsp");
				return false;
			});
		}, 100);
	};

	$scope.init();

} ]);