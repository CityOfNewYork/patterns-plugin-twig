# Patterns CLI Twig Plugin

This plugin command script for the [Patterns CLI](https://github.com/CityOfNewYork/patterns-cli) will compile Twig view templates using [Twig.js](https://github.com/twigjs/twig.js). It is essentially a copy of the [Slm command script](https://github.com/CityOfNewYork/patterns-cli#slm) that replaces the Slm compiler with Twig. It supports the same command flags, `NODE_ENV` constant, include function, and variables. Configuration is also the same, however, the config file it will look for is named **config/views.js** as opposed to **config/slm.js**.

## What is Twig?

[Twig is a template engine for PHP](https://twig.symfony.com/). Twig.js is an implementation of the same engine for JavaScript.

## Usage

Install as a development dependency in a project that uses the [Patterns CLI](https://github.com/CityOfNewYork/patterns-cli).

```shell
$ npm install @nycopportunity/pttrn-plugin-twig -D
```

Add a proxy command script in the **./bin/** directory:

```shell
$ touch bin/twig.js
$ echo "module.exports = require('@nycopportunity/pttrn-plugin-twig');"
```

This will make the command available to the CLI. Then, Twig files in the source directory can be used in place of Slm files.

```
├ 📂 src/            - Source directory
  ├ 📂 twig/          - Twig extras
    ├ 📁 partials/
    └ 📁 layouts/
  ├ 📂 views/         - Twig views
    ├ 📂 newsletter   - Sub-directory
      └ index.twig
    ├ index.twig      - Homepage
    ├ accordion.twig  - Accordion demo page
    └ buttons.twig    - Buttons demo page
    └ ...
  └ ...
```

Views can then be compiled by running the following command:

```shell
$ npx pttrn twig
✨ Twig in ./src/views/accordion.twig out ./dist/accordion.html
✨ Twig in ./src/views/buttons.twig out ./dist/buttons.html
✨ Twig in ./src/views/index.twig out ./dist/index.html
✨ Twig in ./src/views/newsletter/index.twig out ./dist/newsletter/index.html
```

The script supports the same [./config/slm.js](https://github.com/CityOfNewYork/patterns-cli/blob/main/config/slm.js) options as the slm command, however, it will look for a file named **./config/views.js**. To use the default configuration create a proxy configuration file and export the default Slm config.

```shell
$ touch config/views.js
$ echo "module.exports = require('@nycopportunity/pttrn/config/slm');"
```

Or export your own configuration for the command.

## Namespace

The script adds the namespace `@src` (alternatively, `src::`) for referencing the source directory to extend layouts and includ partials from the **./src/twig/** directory.

**Extending Layouts**

```twig
{% extends "@src/twig/layouts/default.twig" %}
```

**Including Partials**

```twig
{% include '@src/twig/partials/head.twig' %}
```


