class StringAwareRegExp extends RegExp {
	static get [Symbol.species]() { return RegExp; }

	constructor(regex, flags){
		if(regex instanceof RegExp) regex = StringAwareRegExp.prototype.regExpToInnerRegexString(regex);

		regex = super(`${StringAwareRegExp.prototype.disqualifyStringsRegExp}(${regex})`, flags);

		return regex;
	}

	stringReplace(sourceString, replaceString = ''){
		return sourceString.replace(this, (match, group1) => { return group1 === undefined ? match : replaceString; });
	}
}

StringAwareRegExp.prototype.regExpToInnerRegexString = function(regExp){ return regExp.toString().replace(/^\/|\/[gimsuy]*$/g, ''); };
Object.defineProperty(StringAwareRegExp.prototype, 'disqualifyStringsRegExp', {
	get: function(){
		return StringAwareRegExp.prototype.regExpToInnerRegexString(/\\\/|\/\s*(?:\\\/|[^\/\*\n])+\/|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*'|\\`|`(?:\\`|[^`])*`|/);
	}
});

class CommentRegExp extends StringAwareRegExp {
	constructor(regex, flags){
		if(regex instanceof RegExp) regex = StringAwareRegExp.prototype.regExpToInnerRegexString(regex);

		return super(`\\/\\/${regex}$|(?:<!--|\\/\\s*\\*)\\s*${regex}\\s*(?:-->|\\*\\s*\\/)`, flags);
	}
}

class StatementRegExp extends StringAwareRegExp {
	constructor(regex, flags){
		if(regex instanceof RegExp) regex = StringAwareRegExp.prototype.regExpToInnerRegexString(regex);

		return super(`${regex}\\s*;?\\s*?`, flags);
	}
}

module.exports = { StringAwareRegExp, CommentRegExp, StatementRegExp };