/**
 * 
 */
var app = angular.module('hub');
app.controller("invoiceController", ['$window', '$scope', '$http', '$location', function($window, $scope, $http, $location) {
	
	var moduleBasePath = 'assets/views/applications/invoices';

	$scope.headerSource;
	$scope.pageSource;
	
	$scope.loadDetail = function(invoiceId) {
		$scope.headerSource = moduleBasePath + "/detail_header.html";
		$scope.pageSource = moduleBasePath + "/detail.html";
	};
	
	$scope.backToList = function() {
		$scope.headerSource = moduleBasePath + "/list_header.html";
		$scope.pageSource = moduleBasePath + "/list.html";
	}
	
	/**
	 * Initialisation process dedicated to start invoicing process.
	 * 
	 * TODO find out a way to avoid double initialization (lazy loading is a way of thinking).
	 */
	$scope.init = function() {
		$scope.backToList();
	};
	
	$scope.init();
}]);