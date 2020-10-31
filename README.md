# page-compiler

A tool to collect and compile html, css, js, and anything else you might want into a single html file.

Utilizes PostCSS and Babel.

## Get

### Install as a dependency in your project
```npm i fatlard1993/page-compiler```

### Install as a devDependency in your project
```npm i --save-dev fatlard1993/page-compiler```

### Install globally for use as a general purpose CLI tool
```npm i -g fatlard1993/page-compiler```


## Use

### Include it in your node project
```
const pageCompiler = require('page-compiler');

const compiledPage = pageCompiler.build('thingOne');
```

### Use it as a CLI tool
```
todo add cli help
```

### Supported import syntax

To make any use of this library you need to define the required components.
Admeditly the implementation is a little ad-hoc and may not work in *all* of the ways you expect, try to keep things as simple as possible to avoid issues..
Your import statements will be removed from the end product as will any module.exports assignment statements.
The resulting code from the list of imports will be inlined above the contents of the file that imported them.
The file type of the file containing import statements will be used to locate the required component unless a particular file type is specified in the import statement.
The file location of the import statements is based on the location of the file containing the import statements, unless one is specified in the import statement.

There are a few ways you can define the components a particular file requires:

#### Comment syntax

This works by starting a comment with a special keyword followed by a space or comma separated list of imports.

Keywords: import, imports, include, includes, require, requires

Eg.
```
//import thingOne thingTwo
/* includes thingOne, thingTwo, thingThree */
<!-- require thingOne thingTwo -->
```

#### ES6 import syntax
(Bypasses any *actual* ES6 behavior)
Eg.
```
import thingOne from 'thingOne';
import { thingTwo, thingThree } from 'otherThing';
import 'anotherThing';
```

#### CommonJS require syntax
(Bypasses any *actual* CommonJS behavior)
Eg.
```
const thingOne = require('thingOne');
let { thingTwo, thingThree } = require('otherThing');
```

#### Sass/Less import atRule syntax
(Bypasses any *actual* Sass/Less behavior)
Eg.
```
@import 'thingOne';
@import 'thingTwo', 'thingThree';
```


## Enable/Disable babel
Babel is enabled by default for any local content, and disabled by default for anything included via a node_modules folder.
Include one of these directive comments if you want to ensure your babel preference is respected.
Snake_case, kabob-case, UpperCamelCase, lowerCamelCase, ALL CAPS.. Whatever floats your boat, the match is case insensitive with an optional separator.
Eg.
```
//enableBabel
/* enable_babel */
// DISABLE_BABEL
/*disable-babel*/
```