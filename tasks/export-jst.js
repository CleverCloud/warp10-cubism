module.exports = (grunt) => {
  const fs = require('fs');
  const Bacon = require('baconjs');

  grunt.registerTask('export-jst', function() {
    const done = this.async();
    const fileName = 'src/templates.js';
    const fileOptions = {
      encoding: 'utf-8'
    };

    const options = this.options({
      namespace: 'Templates'
    });

    const s_export = Bacon.fromNodeCallback(fs.readFile, fileName, fileOptions).map(html => {
      return `module.exports = (() => {\n
          const _ = require("lodash");\n
          ${html}\n
          return this["${options.namespace}"];\n
        })();`;
    }).flatMapLatest(exportedHtml => {
      return Bacon.fromNodeCallback(fs.writeFile, fileName, exportedHtml, fileOptions);
    });

    s_export.onValue(() => {
      grunt.log.writeln('HTML exported');
      done();
    });

    s_export.onError(err => {
      grunt.log.error(err);
      done(false);
    });
  });
};
