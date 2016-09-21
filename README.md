# Gulp Fancy Meta
An Gulp plugin to add and control easily all your HTML meta tag's in your static files, improve your SEO and save your dev time.

The plugin will generate all markup to optimize your social content.
You just need put the 'fancyfile.json' on the root folder of your project and edit with your info.
The generator will put all markup to Twitter cards, Pinterest rich pins, Google's structured data and Facebook's Open Graph inside your HTML files.

## Install
```
npm install gulp-fancy-meta --save-dev
```

## Usage
```
var gulpFancyMeta = require('gulp-fancy-meta');

///////////
// TASK //
///////////
gulp.task('fancyMeta', function() {
    return gulp.src('*.html')
    .pipe(gulpFancyMeta())
    .pipe(gulp.dest(''));
});

///////////
// BUILD //
///////////
gulp.task('default', ['fancyMeta']);
```

And voilà! It's simple. Enjoy! :)
