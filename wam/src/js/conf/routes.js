/**
 * 
 */
window.bypassCORS = true;
window.routes = {
    "/": {
        templateUrl: 'assets/views/pages/login.html?' + new Date().getTime(), 
        controller: 'authentController', 
        requireLogin: true
    },
    "/home": {
        templateUrl: 'assets/views/pages/home.html?' + new Date().getTime(), 
        controller: 'homeController', 
        requireLogin: true
    },
    "/login": {
        templateUrl: 'assets/views/pages/login.html?' + new Date().getTime(), 
        controller: 'authentController', 
        requireLogin: false
    },
    "/stats": {
        templateUrl: 'assets/views/pages/stats.html?' + new Date().getTime(), 
        controller: 'statsController', 
        requireLogin: true
    },
    "/timeline": {
        templateUrl: 'assets/views/pages/timeline.html?' + new Date().getTime(), 
        controller: 'timelineController', 
        requireLogin: true
    },
    "/replay": {
        templateUrl: 'assets/views/applications/replay/replay.html?' + new Date().getTime(), 
        controller: 'replayController', 
        requireLogin: true,
        resolve: {
	    	deps: function($q, $rootScope) {
	    		var deferred = $q.defer();
	    	    var dependencies = [
	    	        'assets/js/controllers/applications/replay/ReplayController.js',
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
    },
    "/calendar": {
        templateUrl: 'assets/views/pages/calendar.html?' + new Date().getTime(), 
        controller: 'calendarController', 
        requireLogin: true
    },
    "/mailbox": {
        templateUrl: 'assets/views/pages/mailbox.html?' + new Date().getTime(), 
        controller: 'mailboxController', 
        requireLogin: true
    },
    "/invoices": {
        templateUrl: 'assets/views/pages/invoice.html?' + new Date().getTime(), 
        controller: 'invoiceController', 
        requireLogin: true
    }
};