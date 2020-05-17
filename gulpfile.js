const  gulp = require('gulp')
const browserSync = require('browser-sync').create()
const 
    plumber = require('gulp-plumber'),
    sourcemaps = require('gulp-sourcemaps'),
    sass = require('gulp-sass'),
    postcss = require('gulp-postcss'),
    autoprefixer = require('gulp-autoprefixer'),
    cache = require('gulp-cache'),
    htmlmin = require('gulp-htmlmin'),
    uglify = require('gulp-uglify-es').default,
    purgecss = require('gulp-purgecss'),
    cssnano = require('cssnano'),
    imagemin = require('gulp-imagemin'),
    useref = require('gulp-useref'),
    mainBowerFiles = require('main-bower-files'),
    gulpif = require('gulp-if'),
    del = require('del'),
    lazypipe = require('lazypipe'),
    size = require('gulp-size'),
    minifyCss = require('gulp-clean-css'),
    wiredep = require('gulp-wiredep'),
    bowerFiles = require('main-bower-files'),
    inject = require('gulp-inject');

const reload = browserSync.reload

var config = {
    global: { // main folders
        input: 'src',
        output: 'dist',
        tmp: '.tmp'
    },
    bower: { // bower.json file
        input: 'bower.json'
    },
    clean: { // generated directories
        tmp: '.tmp/*',
        dist: 'dist/*'
    },
    fonts: { // font paths
        input: 'src/fonts/**/*', 
        output: 'dist/fonts',
        bower: '**/*.{eot,svg,ttf,woff,woff2}', // we only need these file types for the 'fonts' task
        tmp: '.tmp/fonts'
    }, 
    html: { // html paths
        input: 'src/**/*.html',
    },
    images: { // image paths
        input: 'src/images/**/*',
        output: 'dist/images'
    },
    scripts: { // script paths
        input: 'src/scripts/**/*.js',
        output: 'dist/js',
        tmp: '.tmp/js'
    },
    size: { // dislays size of the folder below it's build
        output: 'dist/**/*'
    },
    static: { // static files --> everything except html files
        input: ['src/*.*', '!src/*.html']
    },
    styles: { // style paths
        all: 'src/scss/**/*.{scss,sass}',
        input: 'src/scss/main.{scss,sass}',
        output: 'dist/css',
        bower: 'src/scss',
        tmp: '.tmp/css'
    }
}

/* SERVE TASK
 * --------------------------------------------------
 *  Livereload with browserSync, watch files on 
 *  change and execute tasks accordingly
 * 
 *  http://localhost:3000
 * -------------------------------------------------- */
gulp.task('serve', function() {
    browserSync.init({
        server: {
            baseDir: [config.global.tmp, config.global.input],
            routes: {
                '/bower_components': 'bower_components'
            },
            notify: false,
            port: 3000
        }
    })
})


gulp.task('watch', function() {
    gulp.watch(config.html.input).on('change', reload);
    gulp.watch(config.styles.all, gulp.parallel('styles'));
    gulp.watch(config.scripts.input,  gulp.parallel('scripts'));
    gulp.watch(config.images.input,  gulp.parallel('images'));
    gulp.watch(config.fonts.input,  gulp.parallel('fonts'));
    gulp.watch(config.bower.input,  gulp.parallel('inject', 'fonts')); // execute wiredep when bower.json changes; this will automatically inject assets from bower_components in our HTML or SCSS
})

/* STYLES TASK
 * --------------------------------------------------
 *  Compile SCSS, autoprefix and make sourcemap
 * -------------------------------------------------- */
gulp.task('styles', function() {
    return gulp.src(config.styles.all)
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass({
        outputStyle: 'nested',
        includePaths: ['.']
    }).on('error', sass.logError))
    .pipe(
        autoprefixer({ 
            grid: true,
            overrideBrowserslist: ['last 10 versions'] 
        })
    )
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(config.styles.tmp))
    .pipe(reload({ stream: true }))
})

/* SCRIPTS TASK
 * --------------------------------------------------
 *  Lint JS file(s) and report errors in console
 * -------------------------------------------------- */
gulp.task('scripts', function() {
    return gulp.src([config.scripts.input])
        .pipe(plumber())
        .pipe(gulp.dest(config.scripts.tmp))
        .pipe(reload({ stream: true, once: true }))
})

/* IMAGES TASK
 * --------------------------------------------------
 *  Compress images - PNG, JPG, GIF and SVG
 *  Doesn't remove IDs from SVG files
 * -------------------------------------------------- */
gulp.task('images', function() {
    return  gulp.src([config.images.input])
                .pipe(plumber())
                .pipe(cache(imagemin([
                    imagemin.optipng({ optimizationLevel: 6 }),
                    imagemin.mozjpeg({ progressive: true }),
                    imagemin.gifsicle({ interlaced: true }),
                    imagemin.svgo({
                        plugins: [{ cleanupIDs: false }]
                    })
                ])))
                .pipe(gulp.dest(config.images.output))
                .pipe(reload({ stream: true }))
})

/* FONTS TASK
 * --------------------------------------------------
 *  Get fonts for bower dependencies that need them
 *  and move them to dist and .tmp folder. Concat 
 *  own fonts to mainBowerFiles array if needed
 * -------------------------------------------------- */
gulp.task('fonts', function() {
    return  gulp.src(mainBowerFiles(config.fonts.bower, function(err){})
                .concat(config.fonts.input))
                .pipe(gulp.dest(config.fonts.tmp))
                .pipe(gulp.dest(config.fonts.output))
                .pipe(reload({ stream: true }))
})

/* WIREDEP TASK
 * --------------------------------------------------
 *  Inject bower dependencies in SCSS and NJK files
 * -------------------------------------------------- */

gulp.task('bowerHTML', function() {
    return  gulp.src(config.html.input)
    .pipe(plumber())
    .pipe(inject(gulp.src(bowerFiles(), { read: false }), { name: 'bower' }))
    .pipe(gulp.dest(config.global.input));
})

gulp.task('bowerSCSS', function() {
    return  gulp.src(config.styles.input)
    .pipe(plumber())
    .pipe(inject(gulp.src(bowerFiles(), { read: false }), { 
        starttag: '// bower:{{ext}}',
        endtag:'// endbower',
        transform: function (filepath) {
            return `@import '${filepath.replace(/^\//g, '')}';`;
        }
    }))
    .pipe(gulp.dest(config.styles.bower));
})

gulp.task('inject', gulp.parallel('bowerHTML', 'bowerSCSS'))

/* BUILD TASK
 * --------------------------------------------------
 *  Make all of our src/ files ready for deployment:
 *   - Concatenate same type of files with useref
 *     between build blocks; 'build:{js,css}'
 *   - Uglify JS
 *   - Optimize CSS
 *   - Minify HTML
 * -------------------------------------------------- */
gulp.task('build', function() {
    return  gulp.src(config.html.input)
                .pipe(plumber())
                .pipe(useref({ searchPath: ['.tmp', 'src', '.'] }))
                .pipe(gulpif('*.js', uglify()))
                .pipe(gulpif('*.css', minifyCss()))
                .pipe(gulpif('*.html', htmlmin({ collapseWhitespace: true, removeComments: true })))
                .pipe(gulp.dest(config.global.output))
});

gulp.task('build:css', function() {

})

gulp.task('build:js', function() {
    
})

gulp.task('build:html', function() {
    
})

/* STATIC TASK
 * --------------------------------------------------
 *  Move static files to dist/ folder (robots.txt,
 *  humans.txt, favicon). Hidden files will be
 *  ignored (.git for example)
 * -------------------------------------------------- */
gulp.task('static', function() {
    return gulp.src(config.static.input, {
        dot: true
    }).pipe(gulp.dest(config.global.output));
})

/* CLEAN TASK
 * --------------------------------------------------
 *  Deletes dist/ and .tmp/ folder
 * -------------------------------------------------- */
gulp.task('clean:dist', del.bind(null, config.clean.dist));
gulp.task('clean:tmp', del.bind(null, config.clean.tmp));

/* CLEAR TASK
 * --------------------------------------------------
 *  Clear cache if needed
 * -------------------------------------------------- */
gulp.task('clear', function(done) {
    return cache.clearAll(done)
})

/* SIZE TASK
 * --------------------------------------------------
 *  Display size of dist folder
 * -------------------------------------------------- */
gulp.task('size', function() {
    return  gulp.src(config.size.output)
                .pipe(size({ title: 'Deploynebt build:', gzip: true }))
})

gulp.task('dev', gulp.series('clean:tmp', 'styles', 'scripts', 'images', 'fonts', gulp.parallel('serve', 'watch')))
gulp.task('default', gulp.series('clean:dist', gulp.parallel('build', 'images', 'fonts', 'static'), 'size'))