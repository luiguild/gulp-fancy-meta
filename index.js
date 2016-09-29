'use strict';
const PLUGIN_NAME = 'gulp-fancy-meta';
var fs = require('fs'),
through = require('through2'),
gutil = require('gulp-util');

var indentFile = function(str) {
    var tabSize = 4,
    loc = 0,
    depth = 0,
    tagStack = [],
    carCount = 0,
    out = "",
    inTag = false,
    lastWasInline = false,
    inlineElements = "b big i small tt abbr acronym cite code dfn em kbd strong samp var a bdo br img map object q span sub sup button input label textarea r:property".split(' '),
    voidElements = "!-- area base br col command embed hr img input keygen link meta param source track wbr".split(' '),
    ignoredElements = "script title canvas style pre".split(' ');

    var checkIgnored = function(tagStack) {
        for (var i = ignoredElements.length - 1; i >= 0; i--) {
            for (var j = tagStack.length - 1; j >= 0; j--) {
                if(ignoredElements[i] == tagStack[j]) {
                    return true;
                }
            }
        }
        return false;
    };

    var checkTags = function(tag, tags) {
        for (var i = tags.length - 1; i >= 0; i--) {
            if(tags[i] == tag) {
                return true;
            }
        }
        return false;
    };

    var getElementTag = function(loc, str) {
        var tagLoc = loc;
        var tag = '';
        while(!(/\s|\r|\n|\>|\//.test(str[tagLoc]))) {
            tag += str[tagLoc];
            tagLoc++;
        }
        return tag;
    };

    var getTab = function() {
        var tab = '';
        for(var i=0; i < depth*tabSize; i++) { tab += ' '; }
        return tab;
    };

    while(loc < str.length) {
        if(str[loc] == '<') {
            carCount++;
            if(carCount < 2) {
                var closingTag = (str[loc+1] == '/');
                var tagStart = closingTag ? 2 : 1;
                var tagName = getElementTag(loc+tagStart, str);
                var inlineElement = checkTags(tagName, inlineElements);
                var voidElement = checkTags(tagName, voidElements);

                if(closingTag && tagStack[tagStack.length-1] == tagName) {
                    var noFormatting = checkIgnored(tagStack);
                    tagStack.pop();
                }
                else {
                    tagStack.push(tagName);
                    var noFormatting = checkIgnored(tagStack);
                }

                if(!noFormatting) {
                    if(closingTag && !inlineElement) {
                        depth--;
                        out = out+"\n"+getTab();
                    }
                    else if(!voidElement && !inlineElement) {
                        if(lastWasInline) {
                            out = out+"\n"+getTab();
                        }
                        depth++;
                    }
                    lastWasInline = inlineElement;
                }
            }
            out = out+str[loc];
            inTag = true;
        }
        else if(str[loc] == '>') {
            carCount--;
            out = out+str[loc];

            if(carCount < 1) {
                var selfClosing = (str[loc-1] == '/');
                var tagName = getElementTag(function(newLoc,str) {
                    while(!/\</.test(str[newLoc-1])) {
                        newLoc--;
                    }
                    if(str[newLoc]=='/') {
                        newLoc++;
                    }
                    return newLoc;
                }(loc,str), str);
                var inlineElement = checkTags(tagName, inlineElements);
                var voidElement = checkTags(tagName, voidElements);

                var noFormatting = checkIgnored(tagStack);

                if(selfClosing && tagStack[tagStack.length-1] == tagName) {
                    tagStack.pop();
                }

                if(voidElement) {
                    voidElement = false;
                }
                else if(selfClosing && !inlineElement && !noFormatting) {
                    depth--;
                }

                var removedOne = false;
                while(/\s|\n|\r/.test(str[loc+1])) {
                    loc++;
                    removedOne = true;
                }
                if(inlineElement && removedOne) {
                    out = out+" ";
                }

                if((str[loc+1] == '<' && str[loc+2] == '/') || inlineElement || noFormatting) {

                }
                else {
                    out = out+"\n"+getTab();
                }
                inTag = false;
            }
        }
        else {
            if(!checkIgnored(tagStack)) {
                var removedOne = false;
                while(/\s|\n|\r/.test(str[loc])) {
                    loc++;
                    removedOne = true;
                }
                if(removedOne && !(inTag && str[loc] == '>')) {
                    out = out+" ";
                }
            }
            if(str[loc] && (str[loc] == '<' || str[loc] == '>')) {
                loc--;
            }
            else {
                out = out+str[loc];
            }
        }
        loc++;
    }
    out = out.replace(/\s+$/gmi, "");
    return out;
};

var readFiles = function() {
    return through.obj(function(file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isBuffer()) {
            var finalFile = writeHtml(transformHtml(new String(file.contents)), file);
            cb(null, finalFile);
        }
    });
};

var transformHtml = function(pageString) {
    var regEx = null,
    regEx1 = null,
    regEx2 = null,
    regEx3 = null,
    headerMatch = null,
    writeHeadTag = true,
    replaceHeader = null,
    indentContent = null;

    regEx1 = /<head>/gmi;
    regEx2 = /<!-- FancyMeta\[beginning] -->(.|\n)*?<!-- FancyMeta\[end] -->/gmi;
    regEx3 = /<head>(.|\n)*?<\/head>/gmi;

    headerMatch = pageString.match(regEx2) ? (pageString.match(regEx2), regEx = regEx2, writeHeadTag = false) : (pageString.match(regEx1), regEx = regEx1, writeHeadTag = true);
    replaceHeader = pageString.replace(regEx, writeHeader(readJson(), writeHeadTag));
    indentContent = indentFile(new String(replaceHeader.match(regEx3)));
    replaceHeader = pageString.replace(regEx3, indentContent);
    return replaceHeader;
};

var readJson = function(err, data) {
    try {
        var jsonData = JSON.parse(fs.readFileSync('./fancyfile.json', 'utf8'));
        return jsonData;
    } catch (err) {
        console.log("[FancyMeta] 'fancyfile.json' not found on your project.");
    }
};

var writeHeader = function (jsonData, writeHeadTag) {
    var headContent = null,
    metaTag = '<meta ',
    linkTag = '<link ',
    baseTag = '<base ',
    scriptTag = '<script',
    contentAttr = ' content="',
    charsetAttr = 'charset="',
    sizesAttr = ' sizes="',
    nameAttr = 'name=',
    relAttr = 'rel=',
    targetAttr = 'target="',
    hrefAttr = ' href="',
    typeAttr = ' type="',
    propertyAttr = 'property=';

    headContent = writeHeadTag ? '<head>\n<!-- FancyMeta[beginning] -->' : '<!-- FancyMeta[beginning] -->';

    headContent += jsonData.metas.charset ? metaTag + charsetAttr + jsonData.metas.charset + '">' : '';

    headContent += jsonData.metas.httpEquiv.cacheControl ? metaTag + 'http-equiv="Cache-Control"' + contentAttr + jsonData.metas.httpEquiv.cacheControl + '">' : '';
    headContent += jsonData.metas.httpEquiv.expires ? metaTag + 'http-equiv="Expires"' + contentAttr + jsonData.metas.httpEquiv.expires + '">' : '';
    headContent += jsonData.metas.httpEquiv.contentSecurityPolicy ? metaTag + 'http-equiv="Content-Security-Policy"' + contentAttr + jsonData.metas.httpEquiv.contentSecurityPolicy + '">' : '';
    headContent += jsonData.metas.httpEquiv.defaultStyle ? metaTag + 'http-equiv="default-style"' + contentAttr + jsonData.metas.httpEquiv.defaultStyle + '">' : '';
    headContent += jsonData.metas.httpEquiv.refresh ? metaTag + 'http-equiv="refresh"' + contentAttr + jsonData.metas.httpEquiv.refresh + '">' : '';

    headContent += jsonData.metas.verificationCodes.google ? metaTag + nameAttr + '"google-site-verification"' + contentAttr + jsonData.metas.verificationCodes.google + '">' : '';
    headContent += jsonData.metas.verificationCodes.bing ? metaTag + nameAttr + '"msvalidate.01"' + contentAttr + jsonData.metas.verificationCodes.bing + '">' : '';
    headContent += jsonData.metas.verificationCodes.yandex ? metaTag + nameAttr + '"yandex-verification"' + contentAttr + jsonData.metas.verificationCodes.yandex + '">' : '';
    
    headContent += jsonData.metas.languages.language ? metaTag + nameAttr + '"language"' + contentAttr + jsonData.metas.languages.language + '">' : '';
    headContent += jsonData.metas.languages.defaultLanguage ? metaTag + nameAttr + '"defaultLanguage"' + contentAttr + jsonData.metas.languages.defaultLanguage + '">' : '';
    headContent += jsonData.metas.languages.availableLanguages ? metaTag + nameAttr + '"availableLanguages"' + contentAttr + jsonData.metas.languages.availableLanguages + '">' : '';

    headContent += jsonData.metas.robots ? metaTag + nameAttr + '"robots"' + contentAttr + jsonData.metas.robots + '">' : '';
    headContent += jsonData.metas.googlebot ? metaTag + nameAttr + '"googlebot"' + contentAttr + jsonData.metas.googlebot + '">' : '';
    headContent += jsonData.metas.Slurp ? metaTag + nameAttr + '"Slurp"' + contentAttr + jsonData.metas.Slurp + '">' : '';
    headContent += jsonData.metas.bingbot ? metaTag + nameAttr + '"bingbot"' + contentAttr + jsonData.metas.bingbot + '">' : '';

    headContent += jsonData.metas.applicationName ? metaTag + nameAttr + '"application-name"' + contentAttr + jsonData.metas.applicationName + '">' : '';
    headContent += jsonData.metas.description ? metaTag + nameAttr + '"description"' + contentAttr + jsonData.metas.description + '">' : '';
    headContent += jsonData.metas.keywords ? metaTag + nameAttr + '"keywords"' + contentAttr + jsonData.metas.keywords + '">' : '';
    headContent += jsonData.metas.country ? metaTag + nameAttr + '"country"' + contentAttr + jsonData.metas.country + '">' : '';
    headContent += jsonData.metas.copyright ? metaTag + nameAttr + '"copyright"' + contentAttr + jsonData.metas.copyright + '">' : '';
    headContent += jsonData.metas.author ? metaTag + nameAttr + '"author"' + contentAttr + jsonData.metas.author + '">' : '';
    headContent += jsonData.metas.replyTo ? metaTag + nameAttr + '"reply-to"' + contentAttr + jsonData.metas.replyTo + '">' : '';
    headContent += jsonData.metas.revisitAfter ? metaTag + nameAttr + '"revisit-after"' + contentAttr + jsonData.metas.revisitAfter + '">' : '';
    headContent += jsonData.metas.expires ? metaTag + nameAttr + '"expires"' + contentAttr + jsonData.metas.expires + '">' : '';
    headContent += jsonData.metas.coverage ? metaTag + nameAttr + '"coverage"' + contentAttr + jsonData.metas.coverage + '">' : '';
    headContent += jsonData.metas.distribution ? metaTag + nameAttr + '"distribution"' + contentAttr + jsonData.metas.distribution + '">' : '';
    headContent += jsonData.metas.rating ? metaTag + nameAttr + '"rating"' + contentAttr + jsonData.metas.rating + '">' : '';

    headContent += jsonData.metas.url.base ? baseTag + hrefAttr + jsonData.metas.url.base + '"/> ' + targetAttr + jsonData.metas.url.target : '';
    headContent += jsonData.metas.url.canonical ? linkTag + relAttr + '"canonical"' + hrefAttr + jsonData.metas.url.canonical + '">' : '';

    headContent += jsonData.metas.og.locale ? metaTag + propertyAttr + '"og:locale"' + contentAttr + jsonData.metas.og.locale + '">' : '';
    headContent += jsonData.metas.og.siteName ? metaTag + propertyAttr + '"og:site_name"' + contentAttr + jsonData.metas.og.siteName + '">' : '';
    headContent += jsonData.metas.og.type ? metaTag + propertyAttr + '"og:type"' + contentAttr + jsonData.metas.og.type + '">' : '';
    headContent += jsonData.metas.og.title ? metaTag + propertyAttr + '"og:title"' + contentAttr + jsonData.metas.og.title + '">' : '';
    headContent += jsonData.metas.og.description ? metaTag + propertyAttr + '"og:description"' + contentAttr + jsonData.metas.og.description + '">' : '';
    headContent += jsonData.metas.og.url ? metaTag + propertyAttr + '"og:url"' + contentAttr + jsonData.metas.og.url + '">' : '';
    headContent += jsonData.metas.og.image ? metaTag + propertyAttr + '"og:image"' + contentAttr + jsonData.metas.og.image + '">' : '';
    headContent += jsonData.metas.og.imageType ? metaTag + propertyAttr + '"og:image:type"' + contentAttr + jsonData.metas.og.imageType + '">' : '';
    headContent += jsonData.metas.og.imageWidth ? metaTag + propertyAttr + '"og:image:width"' + contentAttr + jsonData.metas.og.imageWidth + '">' : '';
    headContent += jsonData.metas.og.imageHeight ? metaTag + propertyAttr + '"og:image:height"' + contentAttr + jsonData.metas.og.imageHeight + '">' : '';

    headContent += jsonData.metas.fb.pageId ? metaTag + propertyAttr + '"fb:page_id"' + contentAttr + jsonData.metas.fb.pageId + '">' : '';
    headContent += jsonData.metas.fb.appId ? metaTag + propertyAttr + '"fb:app_id"' + contentAttr + jsonData.metas.fb.appId + '">' : '';
    headContent += jsonData.metas.fb.admins ? metaTag + propertyAttr + '"fb:admins"' + contentAttr + jsonData.metas.fb.admins + '">' : '';

    headContent += jsonData.metas.twitter.card ? metaTag + nameAttr + '"twitter:card"' + contentAttr + jsonData.metas.twitter.card + '">' : '';
    headContent += jsonData.metas.twitter.site ? metaTag + nameAttr + '"twitter:site"' + contentAttr + jsonData.metas.twitter.site + '">' : '';
    headContent += jsonData.metas.twitter.siteId ? metaTag + nameAttr + '"twitter:site:id"' + contentAttr + jsonData.metas.twitter.siteId + '">' : '';
    headContent += jsonData.metas.twitter.title ? metaTag + nameAttr + '"twitter:title"' + contentAttr + jsonData.metas.twitter.title + '">' : '';
    headContent += jsonData.metas.twitter.description ? metaTag + nameAttr + '"twitter:description"' + contentAttr + jsonData.metas.twitter.description + '">' : '';
    headContent += jsonData.metas.twitter.creator ? metaTag + nameAttr + '"twitter:creator"' + contentAttr + jsonData.metas.twitter.creator + '">' : '';
    headContent += jsonData.metas.twitter.creatorId ? metaTag + nameAttr + '"twitter:creator:id"' + contentAttr + jsonData.metas.twitter.creatorId + '">' : '';
    headContent += jsonData.metas.twitter.image ? metaTag + nameAttr + '"twitter:image"' + contentAttr + jsonData.metas.twitter.image + '">' : '';
    headContent += jsonData.metas.twitter.imageAlt ? metaTag + nameAttr + '"twitter:image:alt"' + contentAttr + jsonData.metas.twitter.imageAlt + '">' : '';
    headContent += jsonData.metas.twitter.player ? metaTag + nameAttr + '"twitter:player"' + contentAttr + jsonData.metas.twitter.player + '">' : '';
    headContent += jsonData.metas.twitter.playerWidth ? metaTag + nameAttr + '"twitter:player:width"' + contentAttr + jsonData.metas.twitter.playerWidth + '">' : '';
    headContent += jsonData.metas.twitter.playerHeight ? metaTag + nameAttr + '"twitter:player:height"' + contentAttr + jsonData.metas.twitter.playerHeight + '">' : '';
    headContent += jsonData.metas.twitter.playerStream ? metaTag + nameAttr + '"twitter:player:stream"' + contentAttr + jsonData.metas.twitter.playerStream + '">' : '';
    headContent += jsonData.metas.twitter.appNameIphone ? metaTag + nameAttr + '"twitter:app:name:iphone"' + contentAttr + jsonData.metas.twitter.appNameIphone + '">' : '';
    headContent += jsonData.metas.twitter.appIdIphone ? metaTag + nameAttr + '"twitter:app:id:iphone"' + contentAttr + jsonData.metas.twitter.appIdIphone + '">' : '';
    headContent += jsonData.metas.twitter.appUrlIphone ? metaTag + nameAttr + '"twitter:app:url:iphone"' + contentAttr + jsonData.metas.twitter.appUrlIphone + '">' : '';
    headContent += jsonData.metas.twitter.appNameIpad ? metaTag + nameAttr + '"twitter:app:name:ipad"' + contentAttr + jsonData.metas.twitter.appNameIpad + '">' : '';
    headContent += jsonData.metas.twitter.appIdIpad ? metaTag + nameAttr + '"twitter:app:id:ipad"' + contentAttr + jsonData.metas.twitter.appIdIpad + '">' : '';
    headContent += jsonData.metas.twitter.appUrlIpad ? metaTag + nameAttr + '"twitter:app:url:ipad"' + contentAttr + jsonData.metas.twitter.appUrlIpad + '">' : '';
    headContent += jsonData.metas.twitter.appNameGooglePlay ? metaTag + nameAttr + '"twitter:app:name:googleplay"' + contentAttr + jsonData.metas.twitter.appNameGooglePlay + '">' : '';
    headContent += jsonData.metas.twitter.appIdGooglePlay ? metaTag + nameAttr + '"twitter:app:id:googleplay"' + contentAttr + jsonData.metas.twitter.appIdGooglePlay + '">' : '';
    headContent += jsonData.metas.twitter.appUrlGooglePlay ? metaTag + nameAttr + '"twitter:app:url:googleplay"' + contentAttr + jsonData.metas.twitter.appUrlGooglePlay + '">' : '';

    headContent += jsonData.metas.viewport ? metaTag + nameAttr + '"viewport"' + contentAttr + (jsonData.metas.viewport.width ? "width=" + jsonData.metas.viewport.width : '') + (jsonData.metas.viewport.height ? ", height=" + jsonData.metas.viewport.height : '') + (jsonData.metas.viewport.initialScale ? ", initial-scale=" + jsonData.metas.viewport.initialScale : '') + (jsonData.metas.viewport.maximumScale ? ", maximum-scale=" + jsonData.metas.viewport.maximumScale : '') + (jsonData.metas.viewport.minimumScale ? ", minimum-scale=" + jsonData.metas.viewport.minimumScale : '') + (jsonData.metas.viewport.userScalable ? ", user-scalable=" + jsonData.metas.viewport.userScalable : '') + '">' : '';

    headContent += jsonData.metas.webAppCapable.ios.appleMobileWebAppCapable ? metaTag + nameAttr + '"apple-mobile-web-app-capable"' + contentAttr + jsonData.metas.webAppCapable.ios.appleMobileWebAppCapable + '">' : '';
    headContent += jsonData.metas.webAppCapable.ios.appleMobileWebAppTitle ? metaTag + nameAttr + '"apple-mobile-web-app-title"' + contentAttr + jsonData.metas.webAppCapable.ios.appleMobileWebAppTitle + '">' : '';
    headContent += jsonData.metas.webAppCapable.ios.appleMobileWebAppStatusBarStyle ? metaTag + nameAttr + '"apple-mobile-web-app-status-bar-style"' + contentAttr + jsonData.metas.webAppCapable.ios.appleMobileWebAppStatusBarStyle + '">' : '';

    headContent += jsonData.metas.webAppCapable.android ? metaTag + nameAttr + '"mobile-web-app-capable"' + contentAttr + jsonData.metas.webAppCapable.android + '">' : '';
    headContent += jsonData.metas.msApplication.tileImage ? metaTag + nameAttr + '"msapplication-TileImage"' + contentAttr + jsonData.metas.msApplication.tileImage + '">' : '';
    headContent += jsonData.metas.msApplication.tileColor ? metaTag + nameAttr + '"msapplication-TileColor"' + contentAttr + jsonData.metas.msApplication.tileColor + '">' : '';

    for (var i = 0; i < jsonData.metas.icons.icon.length; i++) {
        headContent += jsonData.metas.icons.icon ? linkTag + relAttr + '"icon"' + sizesAttr + jsonData.metas.icons.icon[i][0] + '"' +  hrefAttr + jsonData.metas.icons.icon[i][1] + '">' : '';
    }
    for (var i = 0; i < jsonData.metas.icons.shortcutIcon.length; i++) {
        headContent += jsonData.metas.icons.shortcutIcon ? linkTag + relAttr + '"shortcut icon"' + sizesAttr + jsonData.metas.icons.shortcutIcon[i][0] + '"' +  hrefAttr + jsonData.metas.icons.shortcutIcon[i][1] + '">' : '';
    }
    for (var i = 0; i < jsonData.metas.icons.appleTouchIcon.length; i++) {
        headContent += jsonData.metas.icons.appleTouchIcon ? linkTag + relAttr + '"apple-touch-icon"' + sizesAttr + jsonData.metas.icons.appleTouchIcon[i][0] + '"' +  hrefAttr + jsonData.metas.icons.appleTouchIcon[i][1] + '">' : '';
    }
    for (var i = 0; i < jsonData.metas.icons.appleTouchIconPrecomposed.length; i++) {
        headContent += jsonData.metas.icons.appleTouchIconPrecomposed ? linkTag + relAttr + '"apple-touch-icon-precomposed"' + sizesAttr + jsonData.metas.icons.appleTouchIconPrecomposed[i][0] + '"' +  hrefAttr + jsonData.metas.icons.appleTouchIconPrecomposed[i][1] + '">' : '';
    }

    headContent += jsonData.metas.localization.manifest ? linkTag + relAttr + '"localization"' + hrefAttr + jsonData.metas.localization.manifest + '">' : '';

    for (var i = 0; i < jsonData.metas.styles.length; i++) {
        headContent += jsonData.metas.styles ? linkTag + relAttr + '"' + jsonData.metas.styles[i][0] + '"' + typeAttr + jsonData.metas.styles[i][1] + '"' +  hrefAttr + jsonData.metas.styles[i][2] + '">' : '';
    }
    for (var i = 0; i < jsonData.metas.scripts.length; i++) {
        headContent += jsonData.metas.scripts ? scriptTag + typeAttr + jsonData.metas.scripts[i][0] + '" ' + charsetAttr + jsonData.metas.scripts[i][1] + '"' +  hrefAttr + jsonData.metas.scripts[i][2] + '"></script>' : '';
    }

    headContent += jsonData.title.content ? '<title>' + jsonData.title.content + '</title>' : jsonData.title.htmlAttributes ? '<title ' + jsonData.title.htmlAttributes + '>' + jsonData.title.content + '</title>' : '';
    headContent += '<!-- FancyMeta[end] -->';
    return headContent;
};

var writeHtml = function(newContent, file) {
    var newFile = fs.writeFile(file.path, newContent,  function(err) {
        if (err) {
            return console.error(err);
        }
        else {
            console.log("[FancyMeta] Data written successfully.");
            console.log("[FancyMeta] Verify possible duplicated Metadata in your <head>!");
        }
    });
    return newFile;
};
module.exports = readFiles;
