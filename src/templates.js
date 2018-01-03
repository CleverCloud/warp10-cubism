module.exports = (() => {

          const _ = require("lodash");

          this["Templates"] = this["Templates"] || {};

this["Templates"]["Metrics.cubism-context"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="metrics-context" data-plugin-id="' +
__e( pluginId ) +
'">\n  <div class="metrics-context-header">\n    <h4>\n      ' +
__e( pluginName ) +
'\n      ';
 if(pluginUnit){ ;
__p += '\n        (' +
__e( pluginUnit ) +
')\n      ';
};
__p += '\n    </h4>\n  </div>\n  <div class="metrics-context-body"></div>\n</div>\n';

}
return __p
};

this["Templates"]["Metrics.cubism-deploy-context"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="card-container deploy-context-container">\n  <div class="bloc">\n    <div class="bloc-popin">\n      <div class="align-left">\n        <strong>' +
__e( T("console.metrics.deployment") ) +
'</strong><br>\n        ';
 if(commitId){ ;
__p += '\n          <strong>Commit</strong>\n        ';
};
__p += '\n      </div>\n      <div class="align-right">\n        <span class="commit">#' +
__e( deployNumber ) +
'</span><br>\n        ';
 if(commitId){ ;
__p += '\n          <span class="commit">#' +
__e( commitId ) +
'</span>\n        ';
};
__p += '\n      </div>\n    </div>\n  </div>\n\n  <div class="deploy-context" data-deploy-number="' +
__e( deployNumber ) +
'"></div>\n</div>\n';

}
return __p
};

          return this["Templates"];

        })();