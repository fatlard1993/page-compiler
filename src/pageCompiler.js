
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

const { StringAwareRegExp, CommentRegExp, StatementRegExp } = require('./stringAwareRegExp');

const pageCompiler = module.exports = {
	fileRegex: /^(\/?.+\/)?(.+)(?:\.(.+))$/,
	moduleExportsRegex: /^\s*module\.exports.*$|module\.exports\s*=\s*/gm,
	allCommentsRegex: new CommentRegExp(/[\s\S]*?/, 'gm'),
	enableBabelRegex: new CommentRegExp(/enable-?_?\s?babel/, 'gmi'),
	disableBabelRegex: new CommentRegExp(/disable-?_?\s?babel/, 'gmi'),
	includeRegex: new CommentRegExp(/(?:includes?|imports?|requires?)\s+(.+?)/, 'gm'),
	importRegex: new StatementRegExp(/import\s+(?:(?:\w+|{(?:\s*\w\s*,?\s*)+})\s+from)?\s*['"`](.+?)['"`]/, 'gm'),
	requireRegex: new StatementRegExp(/(?:var|let|const)\s+(?:(?:\w+|{(?:\s*\w\s*,?\s*)+}))\s*=\s*require\s*\(\s*['"`](.+?)['"`]\s*\)/, 'gm'),
	atImportRegex: new StatementRegExp(/@import\s*['"`](.+?)['"`]/, 'gm'),
	importSeparatorRegex: /['"`]\s*,\s*['"`]|\s*,\s*|\s+/g,
	startText: '<!DOCTYPE html>\n<html lang="en"><head>\n',
	openText: '\n</head><body>\n',
	closeText: '\n</body></html>',
	prebuilt: {
		'htmlOpen.html': '<!DOCTYPE html>\n<html lang="en"><head>\n',
		'head.html': '\t<title>XXX</title>',
		'bodyOpen.html': '\n</head><body>\n',
		'htmlClose.html': '\n</body></html>',
		'error.html': `// includes error.js error.css
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

		file.text += `${pageCompiler.startText}${pageCompiler.cache[pageCompiler.headFileLocation].text.replace(/XXX/gm, name)}`;

		if(file.webmanifest){
			var test = JSON.stringify(JSON.parse(file.webmanifest));
			log.warn('Possible issues with including a manifest this way: ', test);
			file.text += `\n<link rel="manifest" href='data:application/manifest+json,${test}' />`;
		}
		if(file.js) file.text += `\n<script>${file.js}</script>`;
		if(pageCompiler.cache.postcss[fileLocation]) file.text += `\n<style>${pageCompiler.cache.postcss[fileLocation]}</style>`;

		if(dynamicContent){
			if(typeof dynamicContent === 'object'){
				const dynamicReplacements = Object.keys(dynamicContent);

				dynamicReplacements.forEach((replacement) => {
					const args = dynamicContent[replacement], argsIsArray = regexArgs instanceof Array, regex = argsIsArray ? args[0] : args, flags = argsIsArray ? args[1] : 'gm';

					file.html = file.html.replace(new RegExp(regex, flags), replacement);
				});
			}

			else file.html = file.html.replace(/YYY/gm, dynamicContent);
		}

		file.text += `${pageCompiler.openText}${file.html}${pageCompiler.closeText}`;

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

			var fileStats = this.fileRegex.exec(fileLocation);
			var fileText = fsExtended.catSync(fileLocation);

			this.cache[fileLocation].location = fileLocation;
			this.cache[fileLocation].path = fileStats ? fileStats[1] : '';
			this.cache[fileLocation].name = fileStats ? fileStats[2] : fileLocation;
			this.cache[fileLocation].extension = fileStats ? fileStats[3] : '';

			if(!fileText){
				mtime = 'no file';

				fileText = this.prebuilt[this.cache[fileLocation].name] || '';

				if(!fileText) return log.warn(`Could not include prebuilt "${fileLocation}", does not exist`);
			}

			else this.cache[fileLocation].mtime = String(fs.statSync(fileLocation).mtime);

			const runBabel = (!fileLocation.includes('node_modules') || this.enableBabelRegex.test(fileText)) && !this.disableBabelRegex.test(fileText);

			fileText = fileText.replace(this.moduleExportsRegex, '');
			fileText = this.enableBabelRegex.stringReplace(fileText);
			fileText = this.disableBabelRegex.stringReplace(fileText);

			this.cache[fileLocation].text = fileText;

			this.parseIncludes(this.cache[fileLocation]);

			this.cache[fileLocation].text = this.allCommentsRegex.stringReplace(this.cache[fileLocation].text);

			if(this.cache[fileLocation].extension === 'css'){
				for(var x = 0, keys = Object.keys(this.cache.postcss), count = keys.length; x < count; ++x){
					if(this.cache[keys[x]].cssChildren && this.cache[keys[x]].cssChildren[fileLocation]){
						log.warn(2)(`Invalidating ${keys[x]} postcss cache for ${fileLocation}`);

						delete this.cache.postcss[keys[x]];
					}
				}
			}

			else if(this.cache[fileLocation].extension === 'js' && runBabel){
				try{
					log('Running babel on JS: ', fileLocation);

					this.cache[fileLocation].text = babel.transformSync(this.cache[fileLocation].text, this.opts.babelOptions).code;

					if(this.opts.overwriteWithBabel) fs.writeFileSync(fileLocation, `${this.cache[fileLocation].includesText}\n${this.cache[fileLocation].text}`);
				}

				catch(err){
					log.error('Error running babel on JS: ', file, err);
				}
			}

			log(2)(`Cached ${fileLocation}`);
		}

		else log(3)(`${fileLocation} has valid cache`);

		if(this.cache[fileLocation].extension === 'css' && this.cache[parentName] && (!this.cache[parentName].cssChildren || !this.cache[parentName].cssChildren[fileLocation])){
			this.cache[parentName].cssChildren = this.cache[parentName].cssChildren || {};
			this.cache[parentName].cssChildren[fileLocation] = 1;
		}
	},
	parseIncludes: function(file){
		let includes = {};

		file.includesText = '';

		function stripIncludes(regex){
			[...file.text.matchAll(regex)].forEach((includesMatch) => {
				if(includesMatch[1] === undefined) return log(4)('Skipping string while stripping includes: ', includesMatch[0]);

				file.includesText += includesMatch[0];

				(includesMatch[2] || includesMatch[3]).split(pageCompiler.importSeparatorRegex).forEach((item) => { includes[item] = true; });

				file.text = regex.stringReplace ? regex.stringReplace(file.text) : file.text.replace(regex, '');
			});
		}

		[this.atImportRegex, this.importRegex, this.requireRegex, this.includeRegex].forEach(stripIncludes);

		includes = Object.keys(includes);

		if(!includes.length) return;

		log(1)('Requested includes: ', includes);

		var parsedIncludes = [];

		for(var x = includes.length - 1, fileStats, filePath, fileName, fileExtension; x >= 0; --x){
			fileStats = this.fileRegex.exec(includes[x]);

			filePath = fileStats && fileStats[1] && fileStats[1].replace(/^\/|\/$/g, '');
			fileName = fileStats ? fileStats[2] : includes[x];
			fileExtension = fileStats && fileStats[3] ? fileStats[3] : file.extension;

			includes[x] = this.findFile(fileName, fileExtension, file, filePath);

			if(includes[x] && fs.existsSync(includes[x])) parsedIncludes.push(includes[x]);
		}

		log(1)(`Parsed includes for ${file.name}.${file.extension}`, parsedIncludes);

		file.includes = parsedIncludes;
	},
	findFile: function(name, extension, parentFile, location){
		var filePath;

		if(parentFile && parentFile.path){
			try{
				filePath = findRoot(parentFile.path);
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

			if(parentFile && fileLocation === parentFile.location){
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

		if(!fileLocation && !this.prebuilt[name]) log.warn(`Could not find "${name}.${extension}" to include in "${parentFile ? parentFile.location : name}" - does not exist`);

		return fileLocation || (this.prebuilt[name] ? `prebuilt/${name}.${extension}` : '');
	}
};

module.exports = pageCompiler;