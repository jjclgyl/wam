/**
 * 
 */
var app = angular.module('hub', [ 'ngRoute', 'ngCookies' ]);

// configure our routes
app.config(function($routeProvider, $controllerProvider, $compileProvider, $filterProvider, $provide, $httpProvider) {

	if(window.bypassCORS) {
		// http://collab.ca-devtu-zsdb0.credit-agricole.fr/portail/?structureId=87800&usage=COL&hostname=QAZSD0015401&ip=10.156.0.132#!accueil
		$httpProvider.defaults.useXDomain = true;
		delete $httpProvider.defaults.headers.common['X-Requested-With'];
	}
	
	// register helper in application scope.
	app.controllerProvider = $controllerProvider;
    app.compileProvider    = $compileProvider;
    app.routeProvider      = $routeProvider;
    app.filterProvider     = $filterProvider;
    app.provide            = $provide;
    app.httpProvider       = $httpProvider;
	
	/**
	 * Define routing
	 */
	for ( var path in window.routes) {
		$routeProvider.when(path, window.routes[path]);
	}
	$routeProvider.otherwise({
		redirectTo : '/'
	});

	/**
	 * handle 401 from API and then logout user
	 */
	var logsOutUserOn401 = [ '$q', '$location', function($q, $location) {
		
		/**
		 * User is successfully hantenticated
		 */
		var success = function(response) {
			return response;
		};

		/**
		 * Hum, error occurred during process.
		 * Lougout user and redirect to login page
		 */
		var error = function(response) {
			if (response.status === 401) {
				// redirect them back to login page
				$location.path('/login');

				return $q.reject(response);
			} else {
				return $q.reject(response);
			}
		};

		/**
		 * Async process.
		 */
		return function(promise) {
			return promise.then(success, error);
		};
	} ];

	/**
	 * Configuring the response interceptor
	 */
	$httpProvider.responseInterceptors.push(logsOutUserOn401);

}).run(function($rootScope, $location) {

	/**
	 * Handle route changes
	 */
	$rootScope.$on('$routeChangeStart', function(event, next, current) {
	});

});