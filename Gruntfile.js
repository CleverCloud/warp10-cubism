module.exports = function(grunt) {
  const _ = require("lodash");

  const jstOptions = {
    options: {
      namespace: "Templates",
      processName: function(filename) {
        return filename.replace(/.*\/([^\/]+)\._tmpl\.html$/, "$1");
      }
    },
    files: {
      "src/templates.js": ["src/**/templates/**/*._tmpl.html"]
    }
  };

  grunt.initConfig({
    jst: {
      dev: jstOptions,
      dist: (() => {
        const options = _.cloneDeep(jstOptions);
        options.files["dist/templates.js"] = options.files["src/templates.js"];
        return options;
      })()
    },
    less: {
      compile: {
        files: {
          "dist/css/metrics.css": "less/metrics.less",
        }
      }
    }
  });

  grunt.loadTasks("tasks");
  grunt.loadNpmTasks("grunt-contrib-jst");
  grunt.loadNpmTasks("grunt-contrib-less");

  grunt.registerTask("dist", ["jst:dist", "export-jst", "less"]);
  grunt.registerTask("default", ["jst:dev", "export-jst", "less"]);
};
