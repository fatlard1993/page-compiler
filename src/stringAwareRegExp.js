class StringAwareRegExp extends RegExp {
	static get [Symbol.species]() { return RegExp; }

	constructor(regex, flags){
		if(regex instanceof RegExp){
			flags = flags || regex.flags;
			regex = regex.source;
		}

		regex = super(`${/\/.+\/\.|\s*[=(]\s*\/.+\/|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*'|\\`|`(?:\\`|[^`])*`|/.source}(${regex})`, flags);

		return regex;
	}

	stringReplace(sourceString, replaceString = ''){
		return sourceString.replace(this, (match, group1) => { return group1 === undefined ? match : replaceString; });
	}
}

class CommentRegExp extends StringAwareRegExp {
	constructor(regex, flags){
		if(regex instanceof RegExp){
			flags = flags || regex.flags;
			regex = regex.source;
		}

		return super(`\\/\\/${regex}$|(?:<!--|\\/\\s*\\*)\\s*${regex}\\s*(?:-->|\\*\\s*\\/)`, flags);
	}
}

class StatementRegExp extends StringAwareRegExp {
	constructor(regex, flags){
		if(regex instanceof RegExp){
			flags = flags || regex.flags;
			regex = regex.source;
		}

		return super(`${regex}\\s*;?\\s*?`, flags);
	}
}

module.exports = { StringAwareRegExp, CommentRegExp, StatementRegExp };