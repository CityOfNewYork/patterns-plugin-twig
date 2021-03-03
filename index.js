#!/usr/bin/env node

'use strict';

/**
 * Dependencies
 */

const fs = require('fs');
const path = require('path');

const twig = require('twig');
const beautify = require('js-beautify').html;
const marked = require('marked');
const chokidar = require('chokidar');

/**
 * @pttrn Dependencies
 */

// Utilities
const resolve = require('@nycopportunity/pttrn/bin/util/resolve');
const cnsl = require('@nycopportunity/pttrn/bin/util/console');
const args = require('@nycopportunity/pttrn/bin/util/args').args;

// Scripts
const pa11y = require('@nycopportunity/pttrn/bin/pa11y');

// Configurations
const global = resolve('config/global');
const alerts = resolve('config/alerts');

/**
 * Set options to a function for watching config changes
 *
 * @return  {Object}  Containing the script options
 */
const options = () => {
  let config = resolve('config/views', true, false);
  let source = path.join(global.base, global.src);
  let ext = '.twig';

  return {
    config: config,
    source: source,
    dist: path.join(global.base, global.dist),
    base: source,
    views: `${source}/${global.entry.views}`,
    ext: ext,
    globs: [
      resolve('config/views', false),
      `${source}/**/*${ext}`,
      `${source}/**/*.md`
    ]
  }
};

/**
 * Our Chokidar Watcher
 *
 * @type {Source} https://github.com/paulmillr/chokidar
 */
const watcher = chokidar.watch(options().globs, {
  usePolling: false,
  awaitWriteFinish: {
    stabilityThreshold: 750
  }
});

/**
 * Write the html file to the distribution folder
 *
 * @param  {String}  file  The file source
 * @param  {Object}  data  The data to pass to the file
 *
 * @return {String}        The file distribution path
 */
const write = async (file, data) => {
  try {
    let opts = options();
    let dist = file.replace(opts.ext, '.html').replace(opts.views, opts.dist);

    if (!fs.existsSync(path.dirname(dist))){
      fs.mkdirSync(path.dirname(dist));
    }

    if (opts.config.beautify) {
      data = beautify(data, opts.config.beautify);
    }

    fs.writeFileSync(dist, data);

    cnsl.describe(`${alerts.success} Twig in ${alerts.str.path(file)} out ${alerts.str.path(dist)}`);

    return dist;
  } catch (err) {
    cnsl.error(`Twig (write): ${err.stack}`);
  }
}

const mrkdwn = {
  /**
   * Replace code blocks with the desired view template
   *
   * @param   {Object}  data  File contents
   *
   * @return  {String}        File contents with compiled view
   */
  include: function(data) {
    let blocks = data.match(/include{{\s*[/\w\.]+\s*}}/g);

    if (blocks) {
      blocks.forEach(element => {
        let file = element.replace('include{{', '').replace('}}', '').trim();

        let compiled = include(file);

        data = data.replace(element, compiled);
      });
    }

    return data;
  },

  /**
   * Replace mustache like variables with localized vars
   *
   * @param   {String}  data  Compiled markdown
   *
   * @return  {String}        Markdown with interpreted variables
   */
  vars: function(data) {
    let blocks = data.match(/{{\s*[\w\.\-\_]+\s*}}/g);

    if (blocks) {
      blocks.forEach(element => {
        if (element.includes('this.')) {
          let variable = element.replace('{{', '').replace('}}', '')
            .replace('this.', '').trim().split('.');

          let obj = options().config;

          while (variable.length) {
            obj = obj[variable.shift()];
          }

          data = data.replace(element, obj);
        }
      });
    }

    return data;
  }
};

/**
 * Include a file in a template
 *
 * @param  {String}  file   The relative path of the file
 *
 * @return {String}         The compiled file
 */
const include = (file, locals = {}) => {
  let data = file;
  let extname = path.extname(file);
  let opts = options();

  // Assume file is twig if extension isn't specified
  if (extname === '') {
    extname = opts.ext;
    file = file + extname;
  }

  let handler = extname.replace('.', '');

  // Set includes base path (source)
  let dir = opts.source;

  file = path.join(dir, file);

  // Pass file to the compile handler
  if (compile.hasOwnProperty(handler)) {
    data = compile[handler](file, locals);
  } else {
    data = compile['default'](file, locals);

    cnsl.notify(`${alerts.info} Twig (include): no handler exists for ${extname} files. Rendering as is.`);
  }

  return data;
};

/**
 * Compiling methods
 */
const compile = {
  /**
   * Read a twig file and compile it to html, return the data.
   *
   * @param  {String}  file  The path of the file
   * @param  {String}  dir   The base directory of the file
   *
   * @return {String}        The compiled html
   */
  twig: (file, locals = {}) => {
    try {
      if (!fs.existsSync(file)) {
        return '';
      }

      let src = fs.readFileSync(file, 'utf-8');
      let opts = options();

      locals = Object.assign(locals, opts.config);

      // Do not cache partials or layouts
      twig.cache(false);

      // Make the include method available to templates
      twig.extendFunction('include', include);

      let template = twig.twig({
        async: false,
        base: opts.base,
        data: src,
        namespaces: {
          'src': opts.base
        },
        path: file
      });

      let data = template.render(locals);

      if (opts.config.beautify) {
        data = beautify(data, opts.config.beautify);
      }

      return data;
    } catch (err) {
      cnsl.error(`Twig failed (compile.twig): ${err}`);
    }
  },

  /**
   * Read a markdown file and compile it to html, return the data.
   *
   * @param  {String}  file  Path to the file to compile
   *
   * @return {String}        The compiled html
   */
  md: (file, locals = {}) => {
    try {
      if (!fs.existsSync(file)) {
        return '';
      }

      let md = fs.readFileSync(file, 'utf-8');

      marked.setOptions(options().config.marked);

      md = marked(md);

      md = mrkdwn.include(md);

      md = mrkdwn.vars(md);

      return md;
    } catch (err) {
      cnsl.error(`Twig failed (compile.md): ${err.stack}`);
    }
  },

  /**
   * Read a file and return it's contents.
   *
   * @param  {String}  file  Path to the file to compile
   *
   * @return {String}        The file contents
   */
  default: (file, locals = {}) => {
    try {
      if (!fs.existsSync(file)) {
        return '';
      }

      return fs.readFileSync(file, 'utf-8');
    } catch (err) {
      cnsl.error(`Twig failed (compile.default): ${err.stack}`);
    }
  }
};

/**
 * The main function to execute on files
 *
 * @param  {String}  file  The path of the file to read
 */
const main = async (file) => {
  if (file.includes(options().ext)) {
    let compiled = await compile.twig(file);

    let dist = await write(file, compiled);

    if (!args.nopa11y) await pa11y.main(dist);

    return dist;
  }
}

/**
 * Read a specific file or if it's a directory, read all of the files in it
 *
 * @param  {String}  file  A single file or directory to recursively walk
 * @param  {String}  dir   The base directory of the file
 */
const walk = async (file, dir = false) => {
  let opts = options();
  dir = (!dir) ? opts.views : dir;
  file = (file.includes(dir)) ? file : path.join(dir, file);

  if (file.includes(opts.ext)) {
    await main(file);
  } else {
    try {
      let files = fs.readdirSync(file, 'utf-8');

      for (let i = files.length - 1; i >= 0; i--) {
        await walk(files[i], file);
      }
    } catch (err) {
      cnsl.error(`Twig failed (walk): ${err.stack}`);
    }
  }
};

/**
 * Tne runner for single commands and the watcher
 *
 * @param  {String}  dir  The base directory of the file
 */
const run = async () => {
  try {
    let opts = options();
    let dir = opts.views;

    // Skip and notify if the views directory does not exist
    if (!fs.existsSync(dir)) {
      cnsl.watching(`Twig skipping. ${alerts.str.path(dir)} directory does not exist.`);

      process.exit(0);
    }

    let views = fs.readdirSync(dir).filter(view => view.includes(opts.ext));

    // Watcher command
    if (args.watch) {
      watcher.on('change', async changed => {
        if (process.env.NODE_ENV === 'development') {
          // Check if the changed file is in the base views directory
          // let isView = views.some(view => changed.includes(view));

          // Check the parent directory of the changed file
          let hasView = views.some(view => {
            let pttrn = path.basename(view, opts.ext);

            return (
               path.dirname(changed).includes(pttrn) &&
              !path.dirname(changed).includes(dir)
            );
          });

          // Check that the file is in the views directory
          let inViews = changed.includes(dir);

          cnsl.watching(`Detected change on ${alerts.str.path(changed)}`);

          // Run the single compiler task if the changed file is a view or has a view
          // if (isView || hasView) {
          let pttrn = path.basename(path.dirname(changed));
          let view = path.join(dir, pttrn + opts.ext);

          changed = (hasView) ? view : changed;

          if (hasView || inViews) {
            main(changed);
          } else {
          // Walk if the changed file is in the views directory
          // such as a layout template or partial
            await walk(dir);
          }
        } else {
          await walk(dir);
        }
      });

      cnsl.watching(`Twig watching ${alerts.str.ext(opts.globs.join(', '))}`);
    } else {
      await walk(dir);

      cnsl.success(`Twig finished`);

      process.exit(0);
    }
  } catch (err) {
    cnsl.error(`Twig failed (run): ${err.stack}`);
  }
};

/**
 * Export our methods
 *
 * @type {Object}
 */
module.exports = {
  main: main,
  run: run,
  options: options
};
