/**
 * 
 */
var app = angular.module('hub');
app.controllerProvider.register("replayAboutController", ['$window', '$scope', function($window, $scope) {
	
	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		console.log("About is initializing ...");
	};
	
	$scope.init();
	
}]);