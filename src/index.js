#!/usr/bin/env node

const yargs = require('yargs');

yargs.version(false);

yargs.alias({
	h: 'help',
	c: 'color',
	ver: 'version',
	v: 'verbosity',
	r: 'root'
});

yargs.boolean(['h', 'c', 'ver', 'preBabel']);

yargs.default({
	v: 1
});

yargs.describe({
	h: 'This',
	c: 'Enables colored logs',
	v: '<level>',
	r: '<root folder>'
});

var args = yargs.argv;

if(args.dbg){
	args.c = true;
	args.v = Number(args.dbg);
}

else if(args.v) args.v = Number(args.v);

//log args polyfill
process.env.DBG = args.v;
process.env.COLOR = args.ver || args.c;

const path = require('path');
const fs = require('fs');

const babel = require('@babel/core');
const postcss = require('postcss');
const postcssAutoprefixer = require('autoprefixer');
const postcssNesting = require('postcss-nested');
const postcssExtend = require('postcss-extend-rule');
const postcssVariables = require('postcss-simple-vars');
const findRoot = require('find-root');
const fsExtended = require('fs-extended');
const log = require('log');
const util = require('js-util');

const autoprefixerOptions = {
	flexBox: 'no-2009',
	cascade: false
};

const babelOptions = {
	presets: ['@babel/env']
};

const pageCompiler = module.exports = {
	rootFolder: path.resolve(args.root || process.env.ROOT_FOLDER || findRoot(__dirname)),
	includesText: '// includes ',
	babelText: '// babel',
	startText: '<!DOCTYPE html>\n<html lang="en"><head>\n',
	openText: '\n</head><body>\n',
	closeText: '\n</body></html>',
	prebuilt: {
		head: '\t<title>XXX</title>',
		error: `// includes error.js error.css
			<p>Server says...</p>
			<pre>YYY</pre>
			<button onClick="window.location.href = '/'">Back</button>
		`
	},
	build: function(name, dynamicContent){
		pageCompiler.cache = pageCompiler.cache || {};
		pageCompiler.cache.postcss = pageCompiler.cache.postcss || {};

		pageCompiler.rootFolder = args.root || process.env.ROOT_FOLDER || findRoot(__dirname);

		var fileLocation = pageCompiler.findFile(name, 'html');
		var files = pageCompiler.cacheFileAndIncludes(fileLocation);

		log(3)(`[page-compiler] Building file "${name}" with: `, files);

		var file = {
			html: '',
			js: '',
			css: '',
			webmanifest: '',
			text: ''
		};

		for(var x = 0, count = files.length; x < count; ++x){
			if(!pageCompiler.cache[files[x]]){
				log.warn(`[page-compiler] No file cache: ${files[x]}`);

				continue;
			}

			file[pageCompiler.cache[files[x]].extension] += `\n${pageCompiler.cache[files[x]].text}`;
		}

		file.html += pageCompiler.cache[fileLocation] ? pageCompiler.cache[fileLocation].text : '';

		pageCompiler.headFileLocation = pageCompiler.headFileLocation || pageCompiler.findFile('head', 'html');
		pageCompiler.cacheFile(pageCompiler.headFileLocation);

		if(file.css.length && !pageCompiler.cache.postcss[fileLocation]){
			log(`[page-compiler] Rendering ${name} css`);
			log(4)(file.css);

			pageCompiler.cache.postcss[fileLocation] = postcss([postcssAutoprefixer(autoprefixerOptions), postcssNesting(), postcssExtend(), postcssVariables()]).process(file.css);
		}

		file.text += `${pageCompiler.startText}${pageCompiler.cache[pageCompiler.headFileLocation].text.replace('XXX', name)}`;

		if(file.webmanifest) file.text += `<link rel="manifest" href='data:application/manifest+json,${JSON.stringify(JSON.parse(file.webmanifest))}'/>`;
		if(file.js) file.text += `<script>${file.js}</script>`;
		if(pageCompiler.cache.postcss[fileLocation]) file.text += `<style>${pageCompiler.cache.postcss[fileLocation]}</style>`;

		file.text += `${pageCompiler.openText}${dynamicContent ? file.html.replace('YYY', dynamicContent) : file.html}${pageCompiler.closeText}`;

		//todo cache entire file text and invalidate on any includes changes

		return file.text;
	},
	cacheFileAndIncludes: function(fileLocation, parentName, files = []){
		parentName = parentName || fileLocation;

		this.cacheFile(fileLocation, parentName);

		if(!this.cache[fileLocation] || !this.cache[fileLocation].includes) return files;

		for(var x = 0, count = this.cache[fileLocation].includes.length, includesLocation; x < count; ++x){
			includesLocation = this.cache[fileLocation].includes[x];

			if(!includesLocation){
				log.warn(1)(`[page-compiler] No location "${includesLocation}"`);

				continue;
			}

			var oldIndex = files.indexOf(includesLocation);

			if(oldIndex >= 0){
				if(oldIndex > 0){
					files = util.adjustArr(files, oldIndex, 0);

					if(this.cache[includesLocation].includes){
						for(var y = 0, yCount = this.cache[includesLocation].includes.length; y < yCount; ++y){
							files = util.adjustArr(files, files.indexOf(this.cache[includesLocation].includes[y]), 0);
						}
					}
				}

				log.warn(3)(`[page-compiler] Already included ${includesLocation} ${oldIndex}`);

				continue;
			}

			files.unshift(includesLocation);

			this.cacheFileAndIncludes(includesLocation, parentName, files);
		}

		return files;
	},
	cacheFile: function(fileLocation, parentName){
		if(!fileLocation) return;

		var toCache = !this.cache[fileLocation], mtime;

		if(!toCache){
			try{
				mtime = String(fs.statSync(fileLocation).mtime);
			}

			catch(err){
				mtime = err;
			}

			toCache = this.cache[fileLocation].mtime !== mtime;
		}

		if(toCache){
			log(3)(`[page-compiler] Caching ${fileLocation}`);

			this.cache[fileLocation] = this.cache[fileLocation] || {};

			var fileStats = /^(.*\/)?([^\.]*)\.?(.*)?$/.exec(fileLocation);
			var fileText = fsExtended.catSync(fileLocation);

			this.cache[fileLocation].location = fileLocation;
			this.cache[fileLocation].path = fileStats[1];
			this.cache[fileLocation].name = fileStats[2];
			this.cache[fileLocation].extension = fileStats[3];

			if(!fileText){
				mtime = 'no file';

				fileText = this.prebuilt[this.cache[fileLocation].name] || '';

				if(!fileText) log.warn(`[page-compiler] Could not include prebuilt "${fileLocation}", does not exist`);
			}

			else this.cache[fileLocation].mtime = String(fs.statSync(fileLocation).mtime);

			this.cache[fileLocation].includes = this.getIncludes(fileText, this.cache[fileLocation]);

			if(fileText && this.cache[fileLocation].extension === 'css'){
				fileText = fileText.replace(/\/\*([\s\S]*?)\*\/|(?=[\t\s;]{0,})\/\/.*/g, '');

				for(var x = 0, keys = Object.keys(this.cache.postcss), count = keys.length; x < count; ++x){
					if(this.cache[keys[x]].cssChildren && this.cache[keys[x]].cssChildren[fileLocation]){
						log.warn(2)(`[page-compiler] Invalidating ${keys[x]} postcss cache for ${fileLocation}`);

						delete this.cache.postcss[keys[x]];
					}
				}
			}

			else if(this.cache[fileLocation].includes) fileText = fileText.replace(/.*\n/, '\n');

			if(this.cache[fileLocation].extension === 'js' && /^(.*)\n?(.*)\n?/.exec(fileText)[1].startsWith(this.babelText)){
				try{
					log('[page-compiler] Running babel on JS: ', fileLocation);

					fileText = babel.transformSync(fileText, babelOptions).code;

					if(args.preBabel) fs.writeFileSync(fileLocation, this.cache[fileLocation].includesText +'\n'+ fileText);
				}

				catch(err){
					log.error('[page-compiler] Error running babel on JS: ', fileLocation, err);

					fileText = err;
				}
			}

			this.cache[fileLocation].text = fileText;

			log(2)(`[page-compiler] Cached ${fileLocation}`);
		}

		else log(3)(`[page-compiler] ${fileLocation} has valid cache`);

		if(this.cache[fileLocation].extension === 'css' && this.cache[parentName] && (!this.cache[parentName].cssChildren || !this.cache[parentName].cssChildren[fileLocation])){
			this.cache[parentName].cssChildren = this.cache[parentName].cssChildren || {};
			this.cache[parentName].cssChildren[fileLocation] = 1;
		}
	},
	getIncludes: function(text, file){
		var firstLine = /(.*)\n?/.exec(text)[1];

		if(!firstLine.startsWith(this.includesText)) return;

		file.includesText = firstLine;

		var includes = firstLine.substring(12).split(' '), parsedIncludes = [];

		for(var x = includes.length, fileStats, filePath, fileName, fileExtension; x >= 0; --x){
			fileStats = /^(.*\/)?([^\.]*)\.?(.*)?$/.exec(includes[x]);
			filePath = fileStats[1];
			fileName = fileStats[2];
			fileExtension = fileStats[3];

			if(!fileName || fileName === 'undefined') continue;

			fileName += fileExtension === file.extension ? '.'+ fileExtension : '';
			fileExtension = fileExtension || file.extension;

			includes[x] = this.findFile(fileName, fileExtension, file);

			if(includes[x] && fs.existsSync(includes[x])) parsedIncludes.push(includes[x]);
		}

		log(1)(`[page-compiler] Parsed includes for ${file.name}.${file.extension}`, parsedIncludes);

		return parsedIncludes;
	},
	findFile: function(name, extension, file){
		var filePath;

		if(file && file.path){
			try{
				filePath = findRoot(file.path);
			}
			catch(err){
				log.warn(err);
			}
		}

		if(!filePath) filePath = this.rootFolder;

		log(3)(`[page-compiler] Finding file: "${name}.${extension}" from: ${filePath}`);

		var fileLocation;
		var checks = [
			`client/${extension}/${name}.${extension}`,
			`src/${name}.${extension}`,
			`node_modules/${name}/src/index.${extension}`,
			`node_modules/${name}/package.json`,
			`client/resources/${name}.${extension}`,
			`../node_modules/${name}/package.json`,
			`../../node_modules/${name}/package.json`,
			`${name}.${extension}`,
			`testData/${name}.${extension}`
		];

		for(var x = 0, count = checks.length; x < count; ++x){
			fileLocation = path.resolve(filePath, checks[x]);

			if(file && fileLocation === file.location){
				log(1)(`[page-compiler] Skipping include ${fileLocation} ... Same as source`);

				continue;
			}

			if(fs.existsSync(fileLocation)){
				log.info(3)(`[page-compiler] ${fileLocation} exists`);

				if(fileLocation.includes('package.json')){
					var pkg = JSON.parse(fs.readFileSync(fileLocation));

					fileLocation = path.resolve(filePath, checks[x].replace('package.json', ''), pkg['main'+ (extension  === 'css' ? 'Css' : '')] || pkg.main || '');
				}

				break;
			}

			else{
				log.warn(3)(`[page-compiler] ${fileLocation} does not exist`);

				fileLocation = null;
			}
		}

		if(!fileLocation && !this.prebuilt[name]) log.warn(`[page-compiler] Could not find file "${name}.${extension}" for "${file ? file.location : name}" - does not exist`);

		return fileLocation || (this.prebuilt[name] ? `prebuilt/${name}.${extension}` : '');
	}
};