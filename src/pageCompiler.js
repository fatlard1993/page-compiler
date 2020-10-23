
const path = require('path');
const fs = require('fs');

const babel = require('@babel/core');
const postcss = require('postcss');
const postcssMixins = require('postcss-mixins');
const postcssDarkThemeClass = require('postcss-dark-theme-class');
const postcssNested = require('postcss-nested');
const postcssSimpleVars = require('postcss-simple-vars');
const postcssAutoprefixer = require('autoprefixer');
const findRoot = require('find-root');
const fsExtended = require('fs-extended');
const log = new (require('log'))({ tag: 'page-compiler' });
const util = require('js-util');

const pageCompiler = module.exports = {
	importRegex: /import\s*?(?:(?:\S+|{(?:\s*?\w\s*?,?\s*)+})\s*?from)?\s*?'([^']+)';?\n?/,
	moduleExportsRegex: /^.*\b(module\.exports)\b.*$/,
	enableBabelRegex: /^.*\b(enableBabel)\b.*$/gm,
	disableBabelRegex: /^.*\b(disableBabel)\b.*$/gm,
	includesRegex: /^.*\b(disableBabel)\b.*$/gm,
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
	init: function(opts = {}){
		if(!opts.babelOptions){
			opts.babelOptions = {
				cwd: findRoot(__filename),
				presets: ['@babel/env'],
				plugins: [
					['@babel/plugin-proposal-class-properties']
				]
			};
		}

		if(!opts.postcssPlugins){
			opts.postcssPlugins = [
				postcssMixins(),
				postcssSimpleVars(),
				postcssNested(),
				postcssDarkThemeClass(),
				postcssAutoprefixer({
					flexBox: 'no-2009',
					cascade: false
				})
			];
		}

		pageCompiler.opts = opts;

		pageCompiler.rootPath = function rootPath(){ return path.join(pageCompiler.opts.rootFolder, ...arguments); };

		return pageCompiler;
	},
	setOptions: function(opts){
		return pageCompiler.init(Object.assign(pageCompiler.opts || {}, opts));
	},
	build: function(name, dynamicContent){
		pageCompiler.cache = pageCompiler.cache || {};
		pageCompiler.cache.postcss = pageCompiler.cache.postcss || {};

		if(process.env.ROOT_FOLDER) pageCompiler.opts.rootFolder = process.env.ROOT_FOLDER;

		var fileLocation = pageCompiler.findFile(name, 'html');
		var files = pageCompiler.cacheFileAndIncludes(fileLocation);

		log(3)(`Building file "${name}" with: `, files);

		var file = {
			html: '',
			js: '',
			css: '',
			webmanifest: '',
			text: ''
		};

		for(var x = 0, count = files.length; x < count; ++x){
			if(!pageCompiler.cache[files[x]]){
				log.warn(`No file cache: ${files[x]}`);

				continue;
			}

			file[pageCompiler.cache[files[x]].extension] += `\n${pageCompiler.cache[files[x]].text}`;
		}

		file.html += pageCompiler.cache[fileLocation] ? pageCompiler.cache[fileLocation].text : '';

		pageCompiler.headFileLocation = pageCompiler.headFileLocation || pageCompiler.findFile('head', 'html');
		pageCompiler.cacheFile(pageCompiler.headFileLocation);

		if(file.css.length && !pageCompiler.cache.postcss[fileLocation]){
			log(`Rendering ${name} css`);
			log(4)(file.css);

			pageCompiler.cache.postcss[fileLocation] = postcss(pageCompiler.opts.postcssPlugins).process(file.css);
		}

		file.text += `${pageCompiler.startText}${pageCompiler.cache[pageCompiler.headFileLocation].text.replace('XXX', name)}`;

		if(file.webmanifest){
			var test = JSON.stringify(JSON.parse(file.webmanifest));
			log.warn('Possible issues with including a manifest this way: ', test);
			file.text += `\n<link rel="manifest" href='data:application/manifest+json,${test}' />`;
		}
		if(file.js) file.text += `\n<script>${file.js}</script>`;
		if(pageCompiler.cache.postcss[fileLocation]) file.text += `\n<style>${pageCompiler.cache.postcss[fileLocation]}</style>`;

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
				log.warn(1)(`No location "${includesLocation}"`);

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

				log.warn(3)(`Already included ${includesLocation} ${oldIndex}`);

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
			log(3)(`Caching ${fileLocation}`);

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

				if(!fileText) log.warn(`Could not include prebuilt "${fileLocation}", does not exist`);
			}

			else this.cache[fileLocation].mtime = String(fs.statSync(fileLocation).mtime);

			this.cache[fileLocation].includes = this.getIncludes(fileText, this.cache[fileLocation]);

			if(fileText && this.cache[fileLocation].extension === 'css'){
				fileText = fileText.replace(/\/\*([\s\S]*?)\*\/|(?=[\t\s;]{0,})\/\/.*/g, '');

				for(var x = 0, keys = Object.keys(this.cache.postcss), count = keys.length; x < count; ++x){
					if(this.cache[keys[x]].cssChildren && this.cache[keys[x]].cssChildren[fileLocation]){
						log.warn(2)(`Invalidating ${keys[x]} postcss cache for ${fileLocation}`);

						delete this.cache.postcss[keys[x]];
					}
				}
			}

			else if(this.cache[fileLocation].includes){
				if(/(.*)\n?/.exec(fileText)[1].startsWith(this.includesText)) fileText = fileText.replace(/.*\n/, '\n');

				fileText = fileText.replace(new RegExp(this.importRegex, 'gm'), '');

				fileText = fileText.replace(new RegExp(this.moduleExportsRegex, 'gm'), '');
			}

			if(this.cache[fileLocation].extension === 'js' && (!fileLocation.includes('node_modules') || this.enableBabelRegex.test(fileText)) && !this.disableBabelRegex.test(fileText)){
				try{
					log('Running babel on JS: ', fileLocation);

					fileText = babel.transformSync(fileText, this.opts.babelOptions).code;

					if(this.opts.overwriteWithBabel) fs.writeFileSync(fileLocation, this.cache[fileLocation].includesText +'\n'+ fileText);
				}

				catch(err){
					log.error('Error running babel on JS: ', fileLocation, err);

					fileText = err;
				}
			}

			this.cache[fileLocation].text = fileText;

			log(2)(`Cached ${fileLocation}`);
		}

		else log(3)(`${fileLocation} has valid cache`);

		if(this.cache[fileLocation].extension === 'css' && this.cache[parentName] && (!this.cache[parentName].cssChildren || !this.cache[parentName].cssChildren[fileLocation])){
			this.cache[parentName].cssChildren = this.cache[parentName].cssChildren || {};
			this.cache[parentName].cssChildren[fileLocation] = 1;
		}
	},
	getIncludes: function(text, file){
		var firstLine = /(.*)\n?/.exec(text)[1];

		file.includesText = file.includesText || '';

		if(firstLine.startsWith(this.includesText)) file.includesText += firstLine +'\n';

		if(this.importRegex.test(text)) file.includesText += /(import\s\S+\sfrom\s'([^']+)';?\n?)+/.exec(text)[0] +'\n';

		var includes = firstLine.startsWith(this.includesText) ? firstLine.substring(12).split(' ') : [];

		while(this.importRegex.test(text)){
			includes.push(this.importRegex.test(text) && this.importRegex.exec(text)[1]);

			text = text.replace(this.importRegex, '');
		}

		if(!includes.length) return;

		var parsedIncludes = [];

		for(var x = includes.length, fileStats, filePath, fileName, fileExtension; x >= 0; --x){
			fileStats = /^(.*\/)?([^\.]*)\.?(.*)?$/.exec(includes[x]);
			filePath = fileStats[1];
			fileName = fileStats[2];
			fileExtension = fileStats[3];

			if(!fileName || fileName === 'undefined') continue;

			fileExtension = fileExtension || file.extension;

			includes[x] = this.findFile(fileName, fileExtension, file, filePath && filePath.replace(/^\/|\/$/g, ''));

			if(includes[x] && fs.existsSync(includes[x])) parsedIncludes.push(includes[x]);
		}

		log(1)(`Parsed includes for ${file.name}.${file.extension}`, parsedIncludes);

		return parsedIncludes;
	},
	findFile: function(name, extension, file, location){
		var filePath;

		if(file && file.path){
			try{
				filePath = findRoot(file.path);
			}
			catch(err){
				log.warn(err);
			}
		}

		if(!filePath) filePath = this.opts.rootFolder;

		log(1)(`Finding file: "${name}.${extension}" from: ${filePath}`);

		var fileLocation;
		var checks = location ? [
			`${location}/${name}.${extension}`,
			`node_modules/${location}/${name}.${extension}`,
			`../node_modules/${location}/${name}.${extension}`,
			`../../node_modules/${location}/${name}.${extension}`,
		] : [
			`client/${extension}/${name}.${extension}`,
			`src/${name}.${extension}`,
			`node_modules/${name}/src/index.${extension}`,
			`node_modules/${name}/${extension}/${name}.${extension}`,
			`node_modules/${name}/package.json`,
			`client/resources/${name}.${extension}`,
			`../node_modules/${name}/src/index.${extension}`,
			`../node_modules/${name}/${extension}/${name}.${extension}`,
			`../node_modules/${name}/package.json`,
			`../../node_modules/${name}/src/index.${extension}`,
			`../../node_modules/${name}/${extension}/${name}.${extension}`,
			`../../node_modules/${name}/package.json`,
			`${name}.${extension}`,
			`testData/${name}.${extension}`
		];

		for(var x = 0, count = checks.length; x < count; ++x){
			fileLocation = path.resolve(filePath, checks[x]);

			if(file && fileLocation === file.location){
				log(1)(`Skipping include ${fileLocation} .. Same as source`);

				continue;
			}

			if(fs.existsSync(fileLocation)){
				log.info(3)(`${fileLocation} exists`);

				if(fileLocation.includes('package.json')){
					var pkg = JSON.parse(fs.readFileSync(fileLocation));

					fileLocation = path.resolve(filePath, checks[x].replace('package.json', ''), pkg['main'+ (extension === 'css' ? 'Css' : '')] || pkg.main || '');

					if(!fileLocation.endsWith(extension)) fileLocation += `.${extension}`;

					log.info(3)(`Got ${fileLocation} from package.json`);
				}

				break;
			}

			else{
				log.warn(2)(`${fileLocation} does not exist`);

				fileLocation = null;
			}
		}

		if(!fileLocation && !this.prebuilt[name]) log.warn(`Could not find "${name}.${extension}" to include in "${file ? file.location : name}" - does not exist`);

		return fileLocation || (this.prebuilt[name] ? `prebuilt/${name}.${extension}` : '');
	}
};

module.exports = pageCompiler;