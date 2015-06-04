/**
 * 
 */
var app = angular.module('hub');
app.controllerProvider.register("replayShowController", ['$window', '$scope', '$timeout', 'replayService', function($window, $scope, $timeout, replayService) {
	
	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		console.log("Replay show is initializing ...");
		$timeout(function() {
			var tpl = $("#presentationContent1").html();
			$(".overlay, .loading-img").remove();
			$(".box-body").html(tpl);
		}, 2500);
	};
	
	$scope.init();
	
}]);