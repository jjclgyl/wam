/**
 * 
 */
var app = angular.module('hub');
app.controllerProvider.register("replaySettingsController", ['$window', '$scope', function($window, $scope) {
	
	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		console.log("Replay settings is initializing ...");
	};
	
	$scope.init();
	
}]);