/**
 * 
 */
var app = angular.module('hub');
app.directive('lazyLoad', ['$window', '$q',
    function ($window, $q) {
	
		/**
		 * 
		 */
        function load_script(script) {
        	console.log("Loading script [%o]", script);
            var s = document.createElement('script');
            s.src = script.src;
            document.body.appendChild(s);
        }

        /**
         * 
         */
        function lazyLoadScript(script) {
            var deferred = $q.defer();
            $window.initialize = function () {
                deferred.resolve();
            };

            if ($window.attachEvent) {
                $window.attachEvent('onload', function() {
                	load_script(script);
                });
            } else {
                $window.addEventListener('load', function() {
                	load_script(script);
                }, false);
            }
            return deferred.promise;
        }
        
        return {
            restrict: 'E',
            link: function (scope, element, attrs) { 
            	lazyLoadScript({
            		src: attrs.src,
            	});
            }
        };
    }
]);