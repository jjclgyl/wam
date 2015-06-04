/**
 * 
 */
var app = angular.module('hub');
app.controller("homeController", ['$scope', function($scope) {
	
	/**
	 * Define the layout of the dashboard
	 */
	$scope.layout = null;
	
	/**
	 * Columns of widgets
	 */
	$scope.cols = [];
	
	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		
	};
	
	$scope.init();
	
}]);