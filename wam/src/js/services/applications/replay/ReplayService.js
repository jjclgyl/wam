/**
 * 
 */
var app = angular.module('hub');
app.provide.factory("replayService", ['$http', function($http) {
	
	var currentReplay = null;
	
	function fetchReplays() {
		$http.get('/kalmec/undefined').success(function(data, status, headers, config) {
			console.log("Repaly datya loading success");
		}).error(function(data, status, headers, config) {
			console.log("Error occurred on the data layer");
		});
	}
	
	function setCurrentReplay(replay) {
		currentReplay = replay;
	}
	
	function getCurrentReplay() {
		return currentReplay;
	}
	
	return {
		fetchReplays: fetchReplays,
		setCurrentReplay: setCurrentReplay,
		getCurrentReplay: getCurrentReplay
	}
		
}]);