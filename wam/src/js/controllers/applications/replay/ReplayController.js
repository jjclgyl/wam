/**
 * 
 */
var app = angular.module('hub');

app.controller("replayController", ['$scope', 'replayService', function($scope, replayService) {
	
	function initializeApplication(application) {
		application.routeProvider.when('/replay/settings', {
		    templateUrl: 'assets/views/applications/replay/settings.html?' + new Date().getTime(), 
		    controller: 'replaySettingsController', 
		    requireLogin: false,
		    resolve: {
		    	deps: function($q, $rootScope) {
		    		var deferred = $q.defer();
		    	    var dependencies = [
		    	        'assets/js/controllers/applications/replay/ReplaySettingsController.js',
		    	    ];
		    	    $script(dependencies, function() {
		    	        $rootScope.$apply(function() {
		    	            deferred.resolve();
		    	        });
		    	    });
		    	    return deferred.promise;
		    	}
		    }
		}).when('/replay/about', {
			templateUrl: 'assets/views/applications/replay/about.html?' + new Date().getTime(), 
		    controller: 'replayAboutController', 
		    requireLogin: false,
		    resolve: {
		    	deps: function($q, $rootScope) {
		    		var deferred = $q.defer();
		    	    var dependencies = [
		    	        'assets/js/controllers/applications/replay/ReplayAboutController.js',
		    	    ];
		    	    $script(dependencies, function() {
		    	        $rootScope.$apply(function() {
		    	            deferred.resolve();
		    	        });
		    	    });
		    	    return deferred.promise;
		    	}
		    }
		}).when('/replay/show', {
			templateUrl: 'assets/views/applications/replay/show.html?' + new Date().getTime(), 
		    controller: 'replayShowController', 
		    requireLogin: false,
		    resolve: {
		    	deps: function($q, $rootScope) {
		    		var deferred = $q.defer();
		    	    var dependencies = [
		    	        'assets/js/controllers/applications/replay/ReplayShowController.js',
		    	        'assets/js/services/applications/replay/ReplayService.js'
		    	    ];
		    	    $script(dependencies, function() {
		    	        $rootScope.$apply(function() {
		    	            deferred.resolve();
		    	        });
		    	    });
		    	    return deferred.promise;
		    	}
		    }
		});
	}
	
	/**
	 * List of lay  out available for the application
	 * 
	 * @var {object}
	 */
	$scope.layout = {
			list: {
				header: 'assets/views/applications/replay/header.html',
				main: 'assets/views/applications/replay/list.html'
			}
	};
	
	$scope.scripts = [
        {
        	src: 'assets/js/controllers/applications/replay/ReplayHeaderController.js',
        	id: 'replayHeaderController',
        	type: 'text/javascript'
        }
    ];
	
	/**
	 * 
	 */
	$scope.getClassForItem = function(item) {
		var cl = "progress-bar progress-bar-";
		switch(item.status) {
		case 1:
			cl += 'green';
			break;
		case 2:
			cl += 'blue';
			break;
		case 3:
			cl += 'yellow';
		case 4:
			cl += 'red';
			break;
		default:
			cl += 'unknown';
			break;
		}
		return cl;
	};
	
	$scope.fetchProjects = function() {
		var projects = [
			{
				id: 1,
				title: 'Replay Auchan session Lille',
				date: '17/07/2014',
				progress: 55,
				status: 2
			},{
				id: 2,
				title: 'Replay Auchan session Lyon',
				date: '17/07/2014',
				progress: 90,
				status: 4
			},{
				id: 3,
				title: 'Replay Auchan session Paris',
				date: '17/07/2014',
				progress: 35,
				status: 1
			},{
				id: 4,
				title: 'Replay Auchan session Londres',
				date: '17/07/2014',
				progress: 70,
				status: 3
			},
        ];
		
		return projects;
	};
	
	/**
	 * Available project for the user
	 */
	$scope.projects = $scope.fetchProjects();
	
	/**
	 * Current layout in the application.
	 */
	$scope.activeLayout = $scope.layout.list;
	
	/**
	 * 
	 */
	$scope.getActiveHeader = function() {
		return $scope.activeLayout.header;
	};
	
	/**
	 * 
	 */
	$scope.getActiveContent = function() {
		return $scope.activeLayout.main;
	};
	
	/**
	 * Module initialization process.
	 */
	$scope.init = function() {
		initializeApplication(app)
	};
	
	$scope.init();
	
}]);