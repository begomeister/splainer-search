'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SolrSearcherFactory', [
      '$http',
      'SolrDocFactory',
      'activeQueries',
      'defaultSolrConfig',
      'solrSearcherPreprocessorSvc',
      'SearcherFactory',
      SolrSearcherFactory
    ]);

  function SolrSearcherFactory($http, SolrDocFactory, activeQueries, defaultSolrConfig, solrSearcherPreprocessorSvc, SearcherFactory) {
    var Searcher = function(options) {
      SearcherFactory.call(this, options, solrSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;

    function addDocToGroup (groupedBy, group, solrDoc) {
      /*jslint validthis:true*/
      var self = this;

      if (!self.grouped.hasOwnProperty(groupedBy)) {
        self.grouped[groupedBy] = [];
      }

      var found = null;
      angular.forEach(self.grouped[groupedBy], function(groupedDocs) {
        if (groupedDocs.value === group && !found) {
          found = groupedDocs;
        }
      });

      if (!found) {
        found = {docs:[], value:group};
        self.grouped[groupedBy].push(found);
      }

      found.docs.push(solrDoc);
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher ad infinidum
    function pager () {
      /*jslint validthis:true*/
      var self      = this;
      var start     = 0;
      var nextArgs  = angular.copy(self.args);

      if (nextArgs.hasOwnProperty('start')) {
        start = parseInt(nextArgs.start) + 10;

        if (start >= self.numFound) {
          return null; // no more results
        }
      } else {
        start = 10;
      }

      var remaining       = self.numFound - start;
      nextArgs.rows       = ['' + Math.min(10, remaining)];
      nextArgs.start      = ['' + start];
      var pageConfig      = defaultSolrConfig;
      pageConfig.sanitize = false;

      var options = {
        fieldList:  self.fieldList,
        url:        self.url,
        args:       nextArgs,
        queryText:  self.queryText,
        config:     pageConfig
      };

      var nextSearcher = new Searcher(options);

      return nextSearcher;
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      var self      = this;
      var url       = self.callUrl + '&json.wrf=JSON_CALLBACK';
      self.inError  = false;

      var thisSearcher  = self;

      var getExplData = function(solrResp) {
        if (solrResp.hasOwnProperty('debug')) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explain')) {
            return dbg.explain;
          }
        }
        return {};
      };

      var getOthersExplained = function(solrResp) {
        if (solrResp.hasOwnProperty('debug')) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explainOther')) {
            return dbg.explainOther;
          }
        }
      };

      var getHlData = function(solrResp) {
        if (solrResp.hasOwnProperty('highlighting')) {
          return solrResp.highlighting;
        }
        return {};
      };

      activeQueries.count++;
      return $http.jsonp(url).success(function(solrResp) {
        activeQueries.count--;

        var explDict  = getExplData(solrResp);
        var hlDict    = getHlData(solrResp);
        thisSearcher.othersExplained = getOthersExplained(solrResp);

        var parseSolrDoc = function(solrDoc, groupedBy, group) {
          var options = {
            groupedBy:          groupedBy,
            group:              group,
            fieldList:          self.fieldList,
            url:                self.url,
            explDict:           explDict,
            hlDict:             hlDict,
            highlightingPre:    self.HIGHLIGHTING_PRE,
            highlightingPost:   self.HIGHLIGHTING_POST
          };

          return new SolrDocFactory(solrDoc, options);
        };

        if (solrResp.hasOwnProperty('response')) {
          angular.forEach(solrResp.response.docs, function(solrDoc) {
            var doc = parseSolrDoc(solrDoc);
            thisSearcher.numFound = solrResp.response.numFound;
            thisSearcher.docs.push(doc);
          });
        } else if (solrResp.hasOwnProperty('grouped')) {
          angular.forEach(solrResp.grouped, function(groupedBy, groupedByName) {
            thisSearcher.numFound = groupedBy.matches;
            angular.forEach(groupedBy.groups, function(groupResp) {
              var groupValue = groupResp.groupValue;
              angular.forEach(groupResp.doclist.docs, function(solrDoc) {
                var doc = parseSolrDoc(solrDoc, groupedByName, groupValue);
                thisSearcher.docs.push(doc);
                thisSearcher.addDocToGroup(groupedByName, groupValue, doc);
              });
            });
          });
        }
      }).error(function() {
        activeQueries.count--;
        thisSearcher.inError = true;
      });
    }

    // Return factory object
    return Searcher;
  }
})();