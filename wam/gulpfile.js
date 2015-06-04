var gulp        = require('gulp'),
    concat      = require('gulp-concat'),
    uglify      = require('gulp-uglify'),
    jade        = require('gulp-jade'),
    less        = require('gulp-less'),
    path        = require('path'),
    livereload  = require('gulp-livereload'), // Livereload plugin needed: https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei
    marked      = require('marked'), // For :markdown filter in jade
    changed     = require('gulp-changed'),
    prettify    = require('gulp-html-prettify'),
    minifyCSS   = require('gulp-minify-css'),
    htmlify     = require('gulp-angular-htmlify'),
    rename      = require('gulp-rename'),
    flip        = require('css-flip'),
    through     = require('through2'),
    gutil       = require('gulp-util'),
    sourcemaps  = require('gulp-sourcemaps'),
    ngAnnotate  = require('gulp-ng-annotate'),
    webserver   = require('gulp-webserver'),
    markdownpdf = require('gulp-markdown-pdf'),
    PluginError = gutil.PluginError;


var isProduction = true;

// ignore everything that begins with underscore
var hidden_files = '**/_*.*';
var ignored_files = '!'+hidden_files;

// SOURCES CONFIG 
var source = {
  scripts: {
    app:    [ 'js/app.init.js',
              'js/modules/*.js',
              'js/modules/**/*.js',
              'js/custom/**/*.js',
              ignored_files
            ],
    watch: ['js/*.js','js/**/*.js']
  },
  templates: {
    app: {
        files : ['jade/index.jade'],
        watch: ['jade/index.jade', hidden_files]
    },
    views: {
        files : ['jade/views/*.jade', 'jade/views/**/*.jade', ignored_files],
        watch: ['jade/views/**/*.jade']
    },
    pages: {
        files : ['jade/pages/*.jade'],
        watch: ['jade/pages/**/*.jade']
    }
  },
  styles: {
    app: {
      main: ['less/app.less'],
      dir:  'less',
      watch: ['less/**/*.less']
    }
  }
};

// BUILD TARGET CONFIG 
var build = {
  scripts: {
    app: {
      main: 'app.js',
      dir: '../app/js'
    },
  },
  styles: '../app/css',
  templates: {
    app: '..',
    views: '../app/views',
    pages: '../app/pages'
  }
};

var vendor = {
  // used as destiny to copy only required assets from bower
  folder: '../app/vendor',
  // Edit here the scripts that will be included statically.
  // - Requires run `bower install` first
  basePath: '../app/js/',
  baseFile: 'base.js',
  baseInclude: [
    // modernizr custom build
    '../app/js/modernizr/modernizr.custom.js',
    // jQuery
    './bower_components/jquery/dist/jquery.js',
    // Angular
    './bower_components/angular/angular.js',
    './bower_components/angular-route/angular-route.js',
    './bower_components/angular-cookies/angular-cookies.js',
    './bower_components/angular-animate/angular-animate.js',
    './bower_components/angular-ui-router/release/angular-ui-router.js',
    // Angular storage
    './bower_components/ngstorage/ngStorage.js',
    // Angular UI Utils
    './bower_components/angular-ui-utils/ui-utils.js',
    // Angular Translate
    './bower_components/angular-translate/angular-translate.js',
    './bower_components/angular-translate-loader-url/angular-translate-loader-url.js',
    './bower_components/angular-translate-loader-static-files/angular-translate-loader-static-files.js',
    './bower_components/angular-translate-storage-local/angular-translate-storage-local.js',
    './bower_components/angular-translate-storage-cookie/angular-translate-storage-cookie.js',
    // oclazyload
    './bower_components/oclazyload/dist/ocLazyLoad.js',
    // UI Bootstrap
    './bower_components/angular-bootstrap/ui-bootstrap-tpls.js',
    // Loading Bar
    './bower_components/angular-loading-bar/build/loading-bar.js'
  ],
};

var doc = {
  source: '../app/documentation/readme.md',
  dest: '../'
};


//---------------
// TASKS
//---------------

// JS APP
gulp.task('scripts:app', function() {
    // Minify and copy all JavaScript
    return gulp.src(source.scripts.app)
        .pipe(concat(build.scripts.app.main))
        .on("error", handleError)
        .pipe(ngAnnotate())
        .on("error", handleError)
        .pipe( isProduction ? uglify({preserveComments:'some'}) : gutil.noop() )
        .on("error", handleError)
        .pipe(gulp.dest(build.scripts.app.dir))
        ;
});

// LESS APP 
gulp.task('styles:app', function() {
    return gulp.src(source.styles.app.main)
        .pipe( isProduction ? gutil.noop() : sourcemaps.init())
        .pipe(less({
            paths: [source.styles.app.dir]
        }))
        .on("error", handleError)
        .pipe( isProduction ? minifyCSS() : gutil.noop() )
        .pipe( isProduction ? gutil.noop() : sourcemaps.write() )
        .pipe(gulp.dest(build.styles))
        ;
});

// LESS TO RTL
gulp.task('styles:app:rtl', function() {
    return gulp.src(source.styles.app.main)
        .pipe( isProduction ? gutil.noop() : sourcemaps.init())
        .pipe(less({
            paths: [source.styles.app.dir]
        }))
        .on("error", handleError)
        .pipe(flipcss())
        .pipe( isProduction ? minifyCSS() : gutil.noop() )
        .pipe( isProduction ? gutil.noop() : sourcemaps.write() )
        .pipe(rename(function(path) {
            path.basename += "rtl";
            return path;
        }))
        .pipe(gulp.dest(build.styles))
        ;
});

// JADE APP INDEX
gulp.task('templates:app', function() {
    return gulp.src(source.templates.app.files)
        .pipe(changed(build.templates.app, { extension: '.html' }))
        .pipe(jade())
        .on("error", handleError)
        .pipe(htmlify())
        .pipe( isProduction ? gutil.noop() :
          prettify({
            indent_char: ' ',
            indent_size: 3,
            unformatted: ['a', 'sub', 'sup', 'b', 'i', 'u']
          }) )
        .pipe(gulp.dest(build.templates.app))
        ;
});

// JADE PAGES
gulp.task('templates:pages', function() {
    return gulp.src(source.templates.pages.files)
        .pipe(changed(build.templates.pages, { extension: '.html' }))
        .pipe(jade())
        .on("error", handleError)
        .pipe(htmlify())
        .pipe( isProduction ? gutil.noop() :
          prettify({
            indent_char: ' ',
            indent_size: 3,
            unformatted: ['a', 'sub', 'sup', 'b', 'i', 'u']
          }))
        .pipe(gulp.dest(build.templates.pages))
        ;
});

// JADE VIEWS
gulp.task('templates:views', function() {
    return gulp.src(source.templates.views.files)
        .pipe(changed(build.templates.views, { extension: '.html' }))
        .pipe(jade())
        .on("error", handleError)
        .pipe(htmlify())
        .pipe( isProduction ? gutil.noop() :
          prettify({
            indent_char: ' ',
            indent_size: 3,
            unformatted: ['a', 'sub', 'sup', 'b', 'i', 'u']
          }))
        .pipe(gulp.dest(build.templates.views))
        ;
});


gulp.task('webserver', function() {
  gulp.src( build.templates.app )
    .pipe(webserver({
      host:             'localhost',
      port:             '3000',
      livereload:       true,
      directoryListing: false
    }));
});

// Set development mode
// ----------------------

gulp.task('set:dev', function() {
  isProduction = false;
});


// VENDOR TASKS
// --------------

// generates base.js file
gulp.task('vendor:base', function() {
    return gulp.src(vendor.baseInclude)
        .pipe(concat(vendor.baseFile))
        .on("error", handleError)
        .pipe( uglify() )
        .pipe(gulp.dest(vendor.basePath))
        ;
});

// copy file from bower folder into the app vendor folder
gulp.task('vendor:copy', function() {

  var vendorSrc = require('./vendor.json'),
      path = require('path');

  gulp.src(vendorSrc, {base: 'bower_components'})
      .pipe( gulp.dest(vendor.folder) )
      ;

});


// DOCS
// ----------------------------------- 

gulp.task('docs', function () {
    return gulp.src(doc.source)
        .pipe(markdownpdf({
          cssPath: '../app/css/app.css'
        }))
        .pipe(rename(function(path) {
            path.basename = "documentation";
            return path;
        }))
        .pipe(gulp.dest(doc.dest));
});


//---------------
// WATCH
//---------------

gulp.task('watch', function() {
  livereload.listen();

  try {

    gulp.watch(source.scripts.watch,           ['scripts:app']);
    gulp.watch(source.styles.app.watch,        ['styles:app', 'styles:app:rtl']);
    gulp.watch(source.templates.app.watch,     ['templates:app']);
    gulp.watch(source.templates.pages.watch,   ['templates:pages']);
    gulp.watch(source.templates.views.watch,   ['templates:views']);

  } catch(e) {
    console.log(e);
  }

  gulp.watch([
      '../app/**'
  ]).on('change', function(event) {
      livereload.changed();
      // console.log('File', event.path, 'was', event.type);
      // console.log('Triggering LiveReload..');
  });

});

//---------------
// GROUPED TASKS
//---------------

var tasks = [
          'vendor:base',
          'scripts:app',
          'styles:app',
          'styles:app:rtl',
          'templates:app',
          'templates:pages',
          'templates:views'
        ];

var tasksDev = ['set:dev'].concat(tasks).concat(['watch']);

var tasksDevServer = tasksDev.concat('webserver');

gulp.task('default', tasks);

gulp.task('dev', tasksDev);

gulp.task('dev:server', tasksDevServer);





//---------------
// HELPERS
//---------------

// Error handler
function handleError(err) {
  // console.log(err.toString());
  gutil.log(err);
  gutil.beep();
  this.emit('end');
}

// Micro Gulp plugin to flip css (rtl)
function flipcss(opt) {
  
  if (!opt) opt = {};

  // creating a stream through which each file will pass
  var stream = through.obj(function(file, enc, cb) {
    if(file.isNull()) return cb(null, file);

    if(file.isStream()) {
        console.log("todo: isStream!");
    }

    var flippedCss = flip(String(file.contents), opt);
    file.contents = new Buffer(flippedCss);
    cb(null, file);
  });

  // returning the file stream
  return stream;
}
