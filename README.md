# Gulp Fancy Meta
An Gulp plugin to add and control easily all your HTML meta tag's in your static files, improve your SEO and save your dev time.

The plugin will generate all markup to optimize your social content.
You just need put the ```fancyfile.json``` on the root folder of your project and edit with your info.
The generator will put all markup to Twitter cards, Pinterest rich pins, Google's structured data and Facebook's Open Graph inside your HTML files.

Facy Meta will inject inside your ```<head>``` tag the code with the ```fancyfile.json``` content that you already provided. Between the code, the plugin will add twice "markers" like comments in your code to prevent your previous code be deleted.
These comments will be something like this:
```
<!-- FancyMeta[beginning] -->
<meta name="fancyfile-key" content="fancyfile-value">
<!-- FancyMeta[end] -->
```

## Install
```
npm install gulp-fancy-meta --save-dev
```

## In your GulpFile
```
var gulpFancyMeta = require('gulp-fancy-meta');

///////////
// TASK //
//////////
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

## Run
```
gulp
```
or
```
gulp fancyMeta
```
If you are a SEO-ninja, after Gulp run maybe some tags that you already put in your code will be duplicated. Verify your ```<head>``` and check if you not have some tag duplicated in your HTML files.

And voilà! It's simple. Enjoy! :)
