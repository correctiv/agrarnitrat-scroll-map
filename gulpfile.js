'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');
var gulpCopy = require('gulp-copy');

var sourceFiles = [ , 'source2/*.txt' ];
var destination = 'dist/leaflet/';

gulp.task('leaflet-images', function () {
    return gulp.src('node_modules/leaflet/dist/images/*')
      .pipe(gulp.dest('dist/leaflet/images'));
});

gulp.task('css', ['leaflet-images'], function () {
    return gulp.src('node_modules/leaflet/dist/leaflet.css')
      .pipe(gulp.dest('dist/leaflet'));
});

gulp.task('js', function () {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './src/main.js',
    debug: true
  });

  return b.bundle()
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
        .on('error', gutil.log)
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('build', ['js', 'css']);
